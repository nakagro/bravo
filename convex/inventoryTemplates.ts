import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { moduleSettingAllows } from "./modules";

 async function requireSignedIn(ctx: any) {
   const userId = await getAuthUserId(ctx);
   if (!userId) throw new Error("You must be signed in");
   return userId;
 }

 async function requireInventoryAdmin(ctx: any) {
   const userId = await requireSignedIn(ctx);
   const user = await ctx.db.get(userId);
   if (!user) throw new Error("User not found");

   if (user.isAdmin) return userId;

   const moduleSetting = await ctx.db
     .query("moduleSettings")
     .withIndex("by_moduleId", (q: any) => q.eq("moduleId", "inventoryAdmin"))
     .first();

   if (!moduleSettingAllows(user, moduleSetting)) {
     throw new Error("You do not have access to manage inventory templates");
   }

   return userId;
 }

// Rows written before the status field exists have no status, and mean
// "active". Every read goes through this rather than comparing status
// directly, so the no-migration guarantee holds in one place.
const templateStatusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("archived")
);

type TemplateStatus = "active" | "inactive" | "archived";

export function templateStatus(template: { status?: TemplateStatus }): TemplateStatus {
  return template.status ?? "active";
}

// Queries

// Templates, newest-touched first. Defaults to **active only**, which is what
// the member-facing selector wants - so it became correct without being
// touched. Admin screens must pass an explicit `statuses` to see the rest.
export const listTemplates = query({
  args: {
    statuses: v.optional(v.array(templateStatusValidator)),
  },
  handler: async (ctx, { statuses }) => {
    await requireSignedIn(ctx);
    const wanted = statuses ?? ["active"];
    const templates = await ctx.db
      .query("applianceTemplates")
      .withIndex("by_updatedAt")
      .order("desc")
      .collect();
    return templates.filter((t) => wanted.includes(templateStatus(t)));
  },
});

// Deprecated alias, byte-identical to listTemplates before the status filter
// landed. Kept so a deployed frontend that still calls it keeps working while
// the backend leads; remove once the new frontend has shipped (plan Wave 3).
// Deliberately unfiltered, so its behaviour is unchanged.
export const getApplianceTemplates = query({
  args: {},
  handler: async (ctx) => {
    await requireSignedIn(ctx);
    return await ctx.db
      .query("applianceTemplates")
      .withIndex("by_updatedAt")
      .order("desc")
      .collect();
  },
});

export const getTemplateStructure = query({
  args: {
    templateId: v.id("applianceTemplates"),
  },
  handler: async (ctx, { templateId }) => {
    await requireSignedIn(ctx);
    const template = await ctx.db.get(templateId);
    if (!template) return null;

    const sections = await ctx.db
      .query("applianceSections")
      .withIndex("by_template_order", (q) => q.eq("templateId", templateId))
      .order("asc")
      .collect();

    // Fetch items per section
    const sectionsWithItems = await Promise.all(
      sections.map(async (section) => {
        const items = await ctx.db
          .query("applianceItems")
          .withIndex("by_section_order", (q) => q.eq("sectionId", section._id))
          .order("asc")
          .collect();
        return { ...section, items };
      })
    );

    return { template, sections: sectionsWithItems };
  },
});

// Mutations - Templates
export const createApplianceTemplate = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { name, description }) => {
    const userId = await requireInventoryAdmin(ctx);

    const now = Date.now();
    const id = await ctx.db.insert("applianceTemplates", {
      name,
      description,
      version: 1,
      hasUnpublishedChanges: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      metadata: {},
    });
    return id;
  },
});

export const updateApplianceTemplate = mutation({
  args: {
    templateId: v.id("applianceTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    version: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireInventoryAdmin(ctx);

    const { templateId, ...patch } = args;
    const existing = await ctx.db.get(templateId);
    if (!existing) throw new Error("Template not found");

    await ctx.db.patch(templateId, {
      ...patch,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return true;
  },
});

// The single entry point for activate / deactivate / archive / restore, so the
// legal transitions live in one place instead of four call sites.
//
// Restore lands on `inactive`, never `active`: un-archiving an appliance
// shouldn't silently put it back in front of members mid-week. The admin
// re-activates as a separate, deliberate act.
export const setTemplateStatus = mutation({
  args: {
    templateId: v.id("applianceTemplates"),
    status: templateStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, { templateId, status }) => {
    const userId = await requireInventoryAdmin(ctx);

    const template = await ctx.db.get(templateId);
    if (!template) throw new Error("Template not found");

    await ctx.db.patch(templateId, {
      status,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return null;
  },
});

// Permanent delete. Archive is the end state for anything that has ever been
// run - a completed run is a record of what was on the appliance that week,
// and erasing the template erases what its items meant.
export const deleteApplianceTemplate = mutation({
  args: { templateId: v.id("applianceTemplates") },
  handler: async (ctx, { templateId }) => {
    await requireInventoryAdmin(ctx);

    const template = await ctx.db.get(templateId);
    if (!template) throw new Error("Template not found");

    if (templateStatus(template) !== "archived") {
      throw new Error(
        "Archive this template first. Permanent deletion is only possible from the Archived view."
      );
    }

    // One run is enough to refuse; no need to count the rest.
    const runs = await ctx.db
      .query("applianceCheckRuns")
      .withIndex("by_template", (q) => q.eq("templateId", templateId))
      .take(101);
    if (runs.length > 0) {
      const subject =
        runs.length > 100
          ? "More than 100 inventory checks reference"
          : runs.length === 1
            ? "1 inventory check references"
            : `${runs.length} inventory checks reference`;
      throw new Error(
        `${subject} this template - it can stay archived, but it can't be deleted.`
      );
    }

    // Drop the link from any duty crew check pointing here, so deleting can't
    // leave a station check aimed at a template that no longer exists.
    const linkedChecks = await ctx.db.query("stationChecks").collect();
    for (const check of linkedChecks) {
      if (check.linkedApplianceTemplateId === templateId) {
        await ctx.db.patch(check._id, {
          linkedApplianceTemplateId: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    // Delete children sections and items
    const sections = await ctx.db
      .query("applianceSections")
      .withIndex("by_template", (q) => q.eq("templateId", templateId))
      .collect();

    for (const section of sections) {
      const items = await ctx.db
        .query("applianceItems")
        .withIndex("by_section", (q) => q.eq("sectionId", section._id))
        .collect();
      for (const item of items) {
        await ctx.db.delete(item._id);
      }
      await ctx.db.delete(section._id);
    }

    await ctx.db.delete(templateId);
    return true;
  },
});

// Mutations - Sections
export const createSection = mutation({
  args: {
    templateId: v.id("applianceTemplates"),
    name: v.string(),
  },
  handler: async (ctx, { templateId, name }) => {
    const userId = await requireInventoryAdmin(ctx);

    const template = await ctx.db.get(templateId);
    if (!template) throw new Error("Template not found");

    const now = Date.now();
    // Determine next order
    const last = await ctx.db
      .query("applianceSections")
      .withIndex("by_template_order", (q) => q.eq("templateId", templateId))
      .order("desc")
      .first();
    const order = last ? last.order + 1 : 1;

    const id = await ctx.db.insert("applianceSections", {
      templateId,
      name,
      order,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      metadata: {},
    });
    // Mark template as having unpublished changes
    await ctx.db.patch(templateId, {
      hasUnpublishedChanges: true,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return id;
  },
});

export const updateSection = mutation({
  args: {
    sectionId: v.id("applianceSections"),
    name: v.optional(v.string()),
    order: v.optional(v.number()),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { sectionId, imageStorageId, ...patch }) => {
    const userId = await requireInventoryAdmin(ctx);

    const existing = await ctx.db.get(sectionId);
    if (!existing) throw new Error("Section not found");

    // Handle image replacement/deletion
    if (imageStorageId !== undefined) {
      // Delete old image from storage if it exists and we're replacing/removing it
      if (existing.imageStorageId && existing.imageStorageId !== imageStorageId) {
        try {
          await ctx.storage.delete(existing.imageStorageId);
        } catch (error) {
          console.error("Failed to delete old section image:", error);
          // Continue anyway - don't fail the update
        }
      }
    }

    const updateData: any = {
      ...patch,
      updatedAt: Date.now(),
      updatedBy: userId,
    };

    // Handle imageStorageId: null means remove, undefined means don't change
    if (imageStorageId === null) {
      updateData.imageStorageId = undefined; // Remove the field (schema doesn't allow null)
    } else if (imageStorageId !== undefined) {
      updateData.imageStorageId = imageStorageId;
    }

    await ctx.db.patch(sectionId, updateData);
    // Mark template as having unpublished changes
    await ctx.db.patch(existing.templateId, {
      hasUnpublishedChanges: true,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return true;
  },
});

export const deleteSection = mutation({
  args: { sectionId: v.id("applianceSections") },
  handler: async (ctx, { sectionId }) => {
    const userId = await requireInventoryAdmin(ctx);

    const section = await ctx.db.get(sectionId);
    if (!section) throw new Error("Section not found");
    // Delete items under this section
    const items = await ctx.db
      .query("applianceItems")
      .withIndex("by_section", (q) => q.eq("sectionId", sectionId))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(sectionId);
    // Mark template as having unpublished changes
    await ctx.db.patch(section.templateId, {
      hasUnpublishedChanges: true,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return true;
  },
});

// Mutations - Items
export const createItem = mutation({
  args: {
    templateId: v.id("applianceTemplates"),
    sectionId: v.id("applianceSections"),
    name: v.string(),
    itemType: v.optional(
      v.union(
        v.literal("boolean_with_notes"),
        v.literal("boolean"),
        v.literal("text")
      )
    ),
    isRequired: v.optional(v.boolean()),
    defaultNotes: v.optional(v.string()),
  },
  handler: async (ctx, { templateId, sectionId, name, itemType, isRequired, defaultNotes }) => {
    const userId = await requireInventoryAdmin(ctx);

    const template = await ctx.db.get(templateId);
    if (!template) throw new Error("Template not found");

    const section = await ctx.db.get(sectionId);
    if (!section) throw new Error("Section not found");
    if (section.templateId !== templateId) {
      throw new Error("Section does not belong to the specified template");
    }

    const now = Date.now();
    // Determine next order within section
    const last = await ctx.db
      .query("applianceItems")
      .withIndex("by_section_order", (q) => q.eq("sectionId", sectionId))
      .order("desc")
      .first();
    const order = last ? last.order + 1 : 1;

    const id = await ctx.db.insert("applianceItems", {
      templateId,
      sectionId,
      name,
      order,
      itemType: itemType ?? "boolean_with_notes",
      isRequired: isRequired ?? false,
      defaultNotes,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      metadata: {},
    });
    // Mark template as having unpublished changes
    await ctx.db.patch(templateId, {
      hasUnpublishedChanges: true,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return id;
  },
});

export const updateItem = mutation({
  args: {
    itemId: v.id("applianceItems"),
    name: v.optional(v.string()),
    order: v.optional(v.number()),
    itemType: v.optional(
      v.union(
        v.literal("boolean_with_notes"),
        v.literal("boolean"),
        v.literal("text")
      )
    ),
    isRequired: v.optional(v.boolean()),
    defaultNotes: v.optional(v.string()),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    expectedQuantity: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { itemId, imageStorageId, ...patch }) => {
    const userId = await requireInventoryAdmin(ctx);

    if (typeof (patch as any).expectedQuantity !== "undefined") {
      const q = (patch as any).expectedQuantity as number;
      if (!Number.isInteger(q)) {
        throw new Error("Expected quantity must be a whole number");
      }
      if (q < 1) {
        throw new Error("Expected quantity must be at least 1");
      }
    }

    const existing = await ctx.db.get(itemId);
    if (!existing) throw new Error("Item not found");

    // Handle image replacement/deletion
    if (imageStorageId !== undefined) {
      // Delete old image from storage if it exists and we're replacing/removing it
      if (existing.imageStorageId && existing.imageStorageId !== imageStorageId) {
        try {
          await ctx.storage.delete(existing.imageStorageId);
        } catch (error) {
          console.error("Failed to delete old image:", error);
          // Continue anyway - don't fail the update
        }
      }
    }

    const updateData: any = {
      ...patch,
      updatedAt: Date.now(),
      updatedBy: userId,
    };

    // Handle imageStorageId: null means remove, undefined means don't change
    if (imageStorageId === null) {
      updateData.imageStorageId = undefined; // Remove the field (schema doesn't allow null)
    } else if (imageStorageId !== undefined) {
      updateData.imageStorageId = imageStorageId;
    }

    await ctx.db.patch(itemId, updateData);
    // Mark template as having unpublished changes
    await ctx.db.patch(existing.templateId, {
      hasUnpublishedChanges: true,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return true;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireInventoryAdmin(ctx);

    return await ctx.storage.generateUploadUrl();
  },
});

export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireSignedIn(ctx);
    return await ctx.storage.getUrl(storageId);
  },
});

export const deleteItem = mutation({
  args: { itemId: v.id("applianceItems") },
  handler: async (ctx, { itemId }) => {
    const userId = await requireInventoryAdmin(ctx);

    const existing = await ctx.db.get(itemId);
    if (!existing) throw new Error("Item not found");
    await ctx.db.delete(itemId);
    // Mark template as having unpublished changes
    await ctx.db.patch(existing.templateId, {
      hasUnpublishedChanges: true,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return true;
  },
});

// Reorder items within a section
export const reorderItems = mutation({
  args: {
    sectionId: v.id("applianceSections"),
    itemIds: v.array(v.id("applianceItems")),
  },
  handler: async (ctx, { sectionId, itemIds }) => {
    const userId = await requireInventoryAdmin(ctx);

    const section = await ctx.db.get(sectionId);
    if (!section) throw new Error("Section not found");

    // Update order for each item
    for (let i = 0; i < itemIds.length; i++) {
      const item = await ctx.db.get(itemIds[i]);
      if (!item || item.sectionId !== sectionId) {
        throw new Error("Invalid item or section mismatch");
      }
      await ctx.db.patch(itemIds[i], {
        order: i + 1,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
    }

    // Mark template as having unpublished changes
    await ctx.db.patch(section.templateId, {
      hasUnpublishedChanges: true,
      updatedAt: Date.now(),
      updatedBy: userId,
    });

    return true;
  },
});

// Publish: bump version once to capture accumulated structural changes
export const publishTemplate = mutation({
  args: { templateId: v.id("applianceTemplates") },
  handler: async (ctx, { templateId }) => {
    const userId = await requireInventoryAdmin(ctx);

    const tpl = await ctx.db.get(templateId);
    if (!tpl) throw new Error("Template not found");

    await ctx.db.patch(templateId, {
      version: (tpl.version ?? 1) + 1,
      hasUnpublishedChanges: false,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return true;
  },
});

// Clone a template with all its sections and items
export const cloneTemplate = mutation({
  args: {
    templateId: v.id("applianceTemplates"),
    newName: v.string(),
  },
  handler: async (ctx, { templateId, newName }) => {
    const userId = await requireInventoryAdmin(ctx);

    const originalTemplate = await ctx.db.get(templateId);
    if (!originalTemplate) throw new Error("Template not found");

    const now = Date.now();

    // Create the new template
    const newTemplateId = await ctx.db.insert("applianceTemplates", {
      name: newName.trim(),
      description: originalTemplate.description,
      version: 1,
      hasUnpublishedChanges: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      metadata: {},
    });

    // Get all sections from the original template
    const sections = await ctx.db
      .query("applianceSections")
      .withIndex("by_template_order", (q) => q.eq("templateId", templateId))
      .order("asc")
      .collect();

    // Clone each section and its items
    for (const section of sections) {
      const newSectionId = await ctx.db.insert("applianceSections", {
        templateId: newTemplateId,
        name: section.name,
        description: section.description,
        order: section.order,
        imageStorageId: section.imageStorageId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        updatedBy: userId,
        metadata: {},
      });

      // Get all items from the original section
      const items = await ctx.db
        .query("applianceItems")
        .withIndex("by_section_order", (q) => q.eq("sectionId", section._id))
        .order("asc")
        .collect();

      // Clone each item
      for (const item of items) {
        await ctx.db.insert("applianceItems", {
          templateId: newTemplateId,
          sectionId: newSectionId,
          name: item.name,
          description: item.description,
          order: item.order,
          itemType: item.itemType,
          isRequired: item.isRequired,
          defaultNotes: item.defaultNotes,
          imageStorageId: item.imageStorageId,
          expectedQuantity: item.expectedQuantity,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
          updatedBy: userId,
          metadata: {},
        });
      }
    }

    return newTemplateId;
  },
});

// Export a template as JSON (for sharing/backup)
export const exportTemplate = query({
  args: { templateId: v.id("applianceTemplates") },
  handler: async (ctx, { templateId }) => {
    await requireSignedIn(ctx);

    const template = await ctx.db.get(templateId);
    if (!template) throw new Error("Template not found");

    // Get all sections
    const sections = await ctx.db
      .query("applianceSections")
      .withIndex("by_template_order", (q) => q.eq("templateId", templateId))
      .order("asc")
      .collect();

    // Get all items for each section
    const sectionsWithItems = await Promise.all(
      sections.map(async (section) => {
        const items = await ctx.db
          .query("applianceItems")
          .withIndex("by_section_order", (q) => q.eq("sectionId", section._id))
          .order("asc")
          .collect();

        return {
          name: section.name,
          description: section.description,
          order: section.order,
          items: items.map((item) => ({
            name: item.name,
            description: item.description,
            order: item.order,
            itemType: item.itemType,
            isRequired: item.isRequired,
            defaultNotes: item.defaultNotes,
            expectedQuantity: item.expectedQuantity,
          })),
        };
      })
    );

    return {
      exportVersion: 1,
      exportedAt: Date.now(),
      template: {
        name: template.name,
        description: template.description,
      },
      sections: sectionsWithItems,
    };
  },
});

// Import a template from JSON
export const importTemplate = mutation({
  args: {
    data: v.object({
      exportVersion: v.number(),
      exportedAt: v.optional(v.number()),
      template: v.object({
        name: v.string(),
        description: v.optional(v.string()),
      }),
      sections: v.array(
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          order: v.number(),
          items: v.array(
            v.object({
              name: v.string(),
              description: v.optional(v.string()),
              order: v.number(),
              itemType: v.optional(
                v.union(
                  v.literal("boolean_with_notes"),
                  v.literal("boolean"),
                  v.literal("text")
                )
              ),
              isRequired: v.optional(v.boolean()),
              defaultNotes: v.optional(v.string()),
              expectedQuantity: v.optional(v.number()),
            })
          ),
        })
      ),
    }),
    templateName: v.optional(v.string()),
  },
  handler: async (ctx, { data, templateName }) => {
    const userId = await requireInventoryAdmin(ctx);

    if (data.exportVersion !== 1) {
      throw new Error("Unsupported export version");
    }

    const now = Date.now();
    const name = templateName?.trim() || data.template.name;

    // Create the template
    const newTemplateId = await ctx.db.insert("applianceTemplates", {
      name,
      description: data.template.description,
      version: 1,
      hasUnpublishedChanges: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      metadata: {},
    });

    // Create sections and items
    for (const section of data.sections) {
      const newSectionId = await ctx.db.insert("applianceSections", {
        templateId: newTemplateId,
        name: section.name,
        description: section.description,
        order: section.order,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        updatedBy: userId,
        metadata: {},
      });

      for (const item of section.items) {
        await ctx.db.insert("applianceItems", {
          templateId: newTemplateId,
          sectionId: newSectionId,
          name: item.name,
          description: item.description,
          order: item.order,
          itemType: item.itemType ?? "boolean_with_notes",
          isRequired: item.isRequired ?? false,
          defaultNotes: item.defaultNotes,
          expectedQuantity: item.expectedQuantity,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
          updatedBy: userId,
          metadata: {},
        });
      }
    }

    return newTemplateId;
  },
});
