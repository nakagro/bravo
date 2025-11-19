import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const startRun = mutation({
  args: {
    templateId: v.id("applianceTemplates"),
    scheduledDate: v.optional(v.number()),
  },
  handler: async (ctx, { templateId, scheduledDate }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in");

    const template = await ctx.db.get(templateId);
    if (!template) throw new Error("Template not found");
    if (template.hasUnpublishedChanges) {
      throw new Error("Template has unpublished changes. Please publish before starting an inventory check.");
    }
    // Enforce: only one in-progress run per template at a time (any user)
    const runsForTemplate = await ctx.db
      .query("applianceCheckRuns")
      .withIndex("by_template", (q) => q.eq("templateId", templateId))
      .collect();
    const existingForThisTemplate = runsForTemplate.find((r) => r.status === "in_progress");
    if (existingForThisTemplate) {
      throw new Error("An inventory check is already in progress for this template. Please resume or complete it before starting a new one.");
    }

    const now = Date.now();
    const runId = await ctx.db.insert("applianceCheckRuns", {
      templateId,
      templateVersion: template.version,
      templateName: template.name,
      status: "in_progress",
      scheduledDate,
      startedBy: userId,
      startedAt: now,
      completedBy: undefined,
      completedAt: undefined,
      notes: undefined,
      metadata: {},
    });

    // Snapshot sections and items into run items for resilience
    const sections = await ctx.db
      .query("applianceSections")
      .withIndex("by_template_order", (q) => q.eq("templateId", templateId))
      .order("asc")
      .collect();

    for (const section of sections) {
      const items = await ctx.db
        .query("applianceItems")
        .withIndex("by_section_order", (q) => q.eq("sectionId", section._id))
        .order("asc")
        .collect();

      for (const item of items) {
        await ctx.db.insert("applianceCheckRunItems", {
          runId,
          templateId,
          sectionId: section._id,
          itemId: item._id,
          sectionName: section.name,
          sectionOrder: section.order,
          itemName: item.name,
          itemOrder: item.order,
          itemType: item.itemType,
          description: item.description, // Snapshot description
          imageStorageId: item.imageStorageId, // Snapshot image
          value: undefined,
          notes: item.defaultNotes,
          updatedBy: undefined,
          updatedAt: undefined,
        });
      }
    }

    return runId;
  },
});

export const getInProgressRuns = query({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("applianceCheckRuns")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .collect();
    return runs.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  },
});

export const getRun = query({
  args: { runId: v.id("applianceCheckRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run) return null;

    const items = await ctx.db
      .query("applianceCheckRunItems")
      .withIndex("by_run_itemOrder", (q) => q.eq("runId", runId))
      .order("asc")
      .collect();

    // Return flat; client can group by sectionOrder/sectionName
    return { run, items };
  },
});

export const updateRunItem = mutation({
  args: {
    runItemId: v.id("applianceCheckRunItems"),
    value: v.optional(v.union(v.literal("yes"), v.literal("no"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { runItemId, value, notes }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in");

    // Ensure the parent run is still in progress
    const runItem = await ctx.db.get(runItemId);
    if (!runItem) throw new Error("Run item not found");
    const run = await ctx.db.get(runItem.runId);
    if (!run) throw new Error("Run not found");
    if (run.status !== "in_progress") {
      throw new Error("Run is not editable");
    }

    const patch: any = { updatedAt: Date.now(), updatedBy: userId };
    if (typeof value !== "undefined") patch.value = value;
    if (typeof notes !== "undefined") patch.notes = notes;

    await ctx.db.patch(runItemId, patch);
    return true;
  },
});

export const completeRun = mutation({
  args: { runId: v.id("applianceCheckRuns"), notes: v.optional(v.string()) },
  handler: async (ctx, { runId, notes }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in");

    const run = await ctx.db.get(runId);
    if (!run) throw new Error("Run not found");

    await ctx.db.patch(runId, {
      status: "completed",
      completedBy: userId,
      completedAt: Date.now(),
      notes: notes ?? run.notes,
    });
    return true;
  },
});

export const listRecentRuns = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const runs = await ctx.db
      .query("applianceCheckRuns")
      .withIndex("by_startedAt")
      .order("desc")
      .collect();
    return runs.slice(0, limit ?? 20);
  },
});

export const listRunSummaries = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, { limit, status }) => {
    let runs;
    if (status) {
      runs = await ctx.db
        .query("applianceCheckRuns")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      // Sort locally by startedAt desc when filtering by status
      runs.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    } else {
      runs = await ctx.db
        .query("applianceCheckRuns")
        .withIndex("by_startedAt")
        .order("desc")
        .collect();
    }

    const limited = runs.slice(0, limit ?? 20);

    const results = [] as Array<{
      run: any;
      total: number;
      yes: number;
      no: number;
      unanswered: number;
      completedByUser?: {
        name?: string;
        firstName?: string;
        lastName?: string;
        memberNumber?: string;
      } | null;
      startedByUser?: {
        name?: string;
        firstName?: string;
        lastName?: string;
        memberNumber?: string;
      } | null;
    }>;

    for (const run of limited) {
      const items = await ctx.db
        .query("applianceCheckRunItems")
        .withIndex("by_run", (q) => q.eq("runId", run._id))
        .collect();
      const total = items.length;
      let yes = 0, no = 0, unanswered = 0;
      for (const it of items) {
        if (it.value === "yes") yes++;
        else if (it.value === "no") no++;
        else unanswered++;
      }
      
      // Fetch user information
      let completedByUser = null;
      let startedByUser = null;
      
      if (run.completedBy) {
        const user = await ctx.db.get(run.completedBy);
        if (user) {
          completedByUser = {
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            memberNumber: user.memberNumber,
          };
        }
      }
      
      if (run.startedBy) {
        const user = await ctx.db.get(run.startedBy);
        if (user) {
          startedByUser = {
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
            memberNumber: user.memberNumber,
          };
        }
      }
      
      results.push({ run, total, yes, no, unanswered, completedByUser, startedByUser });
    }

    return results;
  },
});

export const getMyInProgressRuns = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const runs = await ctx.db
      .query("applianceCheckRuns")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .collect();

    return runs
      .filter((r) => r.startedBy === userId)
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  },
});

export const getLastCompletedRunsByTemplate = query({
  args: {},
  handler: async (ctx) => {
    // Get all completed runs
    const completedRuns = await ctx.db
      .query("applianceCheckRuns")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    // Group by template and find the most recent for each
    const lastCompletedByTemplate = new Map<string, any>();

    for (const run of completedRuns) {
      const templateId = run.templateId;
      const existing = lastCompletedByTemplate.get(templateId);

      if (!existing || (run.completedAt && (!existing.completedAt || run.completedAt > existing.completedAt))) {
        lastCompletedByTemplate.set(templateId, run);
      }
    }

    // Convert map to array of objects
    return Array.from(lastCompletedByTemplate.entries()).map(([templateId, run]) => ({
      templateId,
      lastCompletedAt: run.completedAt,
      lastCompletedRun: run,
    }));
  },
});
