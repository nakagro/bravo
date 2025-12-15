import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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

   if (!moduleSetting || !moduleSetting.isEnabled) {
     throw new Error("You do not have access to manage inventory templates");
   }

   if (moduleSetting.adminOnly) {
     throw new Error("You do not have access to manage inventory templates");
   }

   const hasRoleReq = !!(moduleSetting.requiredRoles && moduleSetting.requiredRoles.length > 0);
   const hasRankReq = !!moduleSetting.minimumRank;

   let roleOk = true;
   if (hasRoleReq) {
     const userRoles = user.roles || [];
     roleOk = moduleSetting.requiredRoles.some((role: string) => userRoles.includes(role));
   }

   let rankOk = true;
   if (hasRankReq) {
     const rankOrder: Record<string, number> = {
       Probationary: 1,
       Firefighter: 2,
       Lieutenant: 3,
       Captain: 4,
     };

     const userRank = user.rank;
     if (!userRank) {
       rankOk = false;
     } else {
       rankOk = rankOrder[userRank] >= rankOrder[moduleSetting.minimumRank];
     }
   }

   if (hasRoleReq && hasRankReq) {
     if (!(roleOk || rankOk)) {
       throw new Error("You do not have access to manage inventory templates");
     }
   } else {
     if (!(roleOk && rankOk)) {
       throw new Error("You do not have access to manage inventory templates");
     }
   }

   return userId;
 }

// Queries
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

export const listTemplates = query({
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

export const deleteApplianceTemplate = mutation({
  args: { templateId: v.id("applianceTemplates") },
  handler: async (ctx, { templateId }) => {
    await requireInventoryAdmin(ctx);

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
