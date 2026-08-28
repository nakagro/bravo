import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";
import { notifyEvent } from "./lib/notifyEvent";
import { templateStatus } from "./inventoryTemplates";

// Condition key for "an inventory check was completed". Officers map it to
// themselves in Inventory → Admin → Notifications.
export const CHECK_COMPLETED_KEY = "inventory:checkCompleted";

type RunItem = Doc<"applianceCheckRunItems">;

const isQuantityItem = (item: RunItem) => item.expectedQuantity !== undefined;

const isAnswered = (item: RunItem) =>
  isQuantityItem(item)
    ? item.actualQuantity !== undefined
    : typeof item.value !== "undefined";

/** A deviation: the appliance doesn't match what the template says it should carry. */
const isDeviation = (item: RunItem) =>
  isQuantityItem(item)
    ? item.actualQuantity !== undefined && item.actualQuantity !== item.expectedQuantity
    : item.value === "no";

/**
 * Build the notice a completed inventory check raises.
 *
 * Same shape as the duty-crew submission notice, and for the same reason: the
 * point is the exception detail. A completed run tells the officer nothing on
 * its own - what matters is what wasn't on the appliance, what was miscounted,
 * and what nobody checked.
 */
export function buildRunCompletionNotice(items: RunItem[], templateName: string) {
  const deviations = items.filter(isDeviation);
  const notChecked = items.filter((i) => !isAnswered(i));
  const ok = items.filter((i) => isAnswered(i) && !isDeviation(i));
  const withNotes = items.filter((i) => i.notes && i.notes.trim().length > 0);

  const summary = [
    `${ok.length} of ${items.length} OK`,
    deviations.length > 0 ? `${deviations.length} deviation${deviations.length === 1 ? "" : "s"}` : null,
    notChecked.length > 0 ? `${notChecked.length} not checked` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const describeDeviation = (item: RunItem) => {
    const detail = isQuantityItem(item)
      ? `expected ${item.expectedQuantity}, found ${item.actualQuantity}`
      : "not on the appliance";
    return `${item.itemName} - ${detail}${item.notes?.trim() ? `: ${item.notes.trim()}` : ""}`;
  };

  const attention = [
    // Deviations lead - they're the ones that affect whether the truck is ready.
    ...deviations.map(describeDeviation),
    ...notChecked.map(
      (i) => `${i.itemName} - not checked${i.notes?.trim() ? `: ${i.notes.trim()}` : ""}`
    ),
    ...withNotes
      .filter((i) => !isDeviation(i) && isAnswered(i))
      .map((i) => `${i.itemName} - ${i.notes!.trim()}`),
  ];

  return {
    summary,
    attention,
    deviationCount: deviations.length,
    notCheckedCount: notChecked.length,
    description: `${templateName} · ${summary}`,
  };
}

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
    const status = templateStatus(template);
    if (status !== "active") {
      throw new Error(
        status === "archived"
          ? "This appliance has been archived and can no longer be checked."
          : "This appliance is out of service, so its check can't be started."
      );
    }
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
          sectionDescription: section.description, // Snapshot section description
          sectionImageStorageId: section.imageStorageId, // Snapshot section image
          itemName: item.name,
          itemOrder: item.order,
          itemType: item.itemType,
          description: item.description, // Snapshot item description
          imageStorageId: item.imageStorageId, // Snapshot item image
          expectedQuantity: item.expectedQuantity, // Snapshot expected quantity
          actualQuantity: undefined,
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

    // Fetch user info for startedBy and completedBy
    const startedByUser = run.startedBy ? await ctx.db.get(run.startedBy) : null;
    const completedByUser = run.completedBy ? await ctx.db.get(run.completedBy) : null;

    // Return flat; client can group by sectionOrder/sectionName
    return { 
      run, 
      items,
      startedByUser: startedByUser ? {
        firstName: startedByUser.firstName,
        lastName: startedByUser.lastName,
        name: startedByUser.name,
      } : null,
      completedByUser: completedByUser ? {
        firstName: completedByUser.firstName,
        lastName: completedByUser.lastName,
        name: completedByUser.name,
      } : null,
    };
  },
});

export const updateRunItem = mutation({
  args: {
    runItemId: v.id("applianceCheckRunItems"),
    value: v.optional(v.union(v.literal("yes"), v.literal("no"), v.null())),
    actualQuantity: v.optional(v.union(v.number(), v.null())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { runItemId, value, actualQuantity, notes }) => {
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

    // Validate actualQuantity if provided
    if (typeof actualQuantity !== "undefined" && actualQuantity !== null) {
      if (actualQuantity < 0) {
        throw new Error("Quantity cannot be negative");
      }
      if (!Number.isInteger(actualQuantity)) {
        throw new Error("Quantity must be a whole number");
      }
    }

    const patch: any = { updatedAt: Date.now(), updatedBy: userId };
    if (typeof value !== "undefined") {
      patch.value = value === null ? undefined : value;
    }
    if (typeof actualQuantity !== "undefined") {
      patch.actualQuantity = actualQuantity === null ? undefined : actualQuantity;
    }
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

    const runNotes = notes ?? run.notes;

    await ctx.db.patch(runId, {
      status: "completed",
      completedBy: userId,
      completedAt: Date.now(),
      notes: runNotes,
    });

    // Raise the "inventory check done" notice for whoever holds the equipment
    // portfolio. Silent unless an officer has mapped the condition key.
    const items = await ctx.db
      .query("applianceCheckRunItems")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .collect();

    const notice = buildRunCompletionNotice(items, run.templateName);
    const currentUser = await ctx.db.get(userId);
    const completedByName =
      [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" ") ||
      currentUser?.name ||
      "a member";

    await notifyEvent(ctx, {
      moduleId: "inventory",
      conditionKey: CHECK_COMPLETED_KEY,
      title: "Inventory check completed",
      description: notice.description,
      url: `/inventory/run/${runId}`,
      // A missing or miscounted item is an appliance-readiness problem; an
      // unchecked one is only an admin gap.
      priority:
        notice.deviationCount > 0
          ? "high"
          : notice.notCheckedCount > 0
            ? "medium"
            : "low",
      sourceEntityId: runId,
      actorUserId: userId,
      emailSubject:
        notice.deviationCount > 0
          ? `Inventory check completed with ${notice.deviationCount} deviation${notice.deviationCount === 1 ? "" : "s"} - ${run.templateName}`
          : `Inventory check completed - ${run.templateName}`,
      emailIntro: `${completedByName} completed the inventory check for ${run.templateName}.`,
      emailDetails: [
        { label: "Checklist", value: run.templateName },
        { label: "Completed by", value: completedByName },
        { label: "Result", value: notice.summary },
        ...(runNotes?.trim() ? [{ label: "Check notes", value: runNotes.trim() }] : []),
      ],
      emailListTitle: "Needs attention",
      emailList: notice.attention,
    });

    return true;
  },
});

export const cancelRun = mutation({
  args: { runId: v.id("applianceCheckRuns") },
  returns: v.boolean(),
  handler: async (ctx, { runId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in");

    const run = await ctx.db.get(runId);
    if (!run) throw new Error("Run not found");

    if (run.status !== "in_progress") {
      throw new Error("Only in-progress runs can be cancelled");
    }

    await ctx.db.patch(runId, {
      status: "cancelled",
      completedBy: userId,
      completedAt: Date.now(),
    });
    return true;
  },
});

export const deleteRun = mutation({
  args: { runId: v.id("applianceCheckRuns") },
  returns: v.boolean(),
  handler: async (ctx, { runId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in");

    // Check if user has inventoryAdmin access
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    if (!user.isAdmin) {
      const moduleSetting = await ctx.db
        .query("moduleSettings")
        .withIndex("by_moduleId", (q) => q.eq("moduleId", "inventoryAdmin"))
        .first();

      if (!moduleSetting || !moduleSetting.isEnabled) {
        throw new Error("You do not have permission to delete inventory checks");
      }

      if (moduleSetting.adminOnly) {
        throw new Error("You do not have permission to delete inventory checks");
      }

      const rankOrder: Record<string, number> = {
        "Brigade Member": 0,
        Probationary: 1,
        Firefighter: 2,
        Lieutenant: 3,
        Captain: 4,
      };

      if (moduleSetting.minimumRank) {
        const userRank = user.rank;
        if (!userRank || rankOrder[userRank] < rankOrder[moduleSetting.minimumRank]) {
          throw new Error("You do not have permission to delete inventory checks");
        }
      }
    }

    const run = await ctx.db.get(runId);
    if (!run) throw new Error("Run not found");

    // Delete all run items first
    const items = await ctx.db
      .query("applianceCheckRunItems")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    // Delete the run itself
    await ctx.db.delete(runId);
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
        // For quantity items, check if actualQuantity is set
        if (it.expectedQuantity !== undefined) {
          if (it.actualQuantity !== undefined) {
            yes++; // Count as answered
          } else {
            unanswered++;
          }
        } else {
          // For boolean items, check value
          if (it.value === "yes") yes++;
          else if (it.value === "no") no++;
          else unanswered++;
        }
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
