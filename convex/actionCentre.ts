import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";
import { isSharedAccount } from "./lib/accountType";
import { moduleSettingAllows } from "./modules";
import { availabilityProvider } from "./actionCentreProviders/availability";
import { profileProvider } from "./actionCentreProviders/profile";
import { bookingApprovalsProvider } from "./actionCentreProviders/bookings";
import { eventRsvpProvider } from "./actionCentreProviders/events";
import { tasksProvider } from "./actionCentreProviders/tasks";
import { baSkillsLmsProvider } from "./actionCentreProviders/baSkills";
import { dutyCrewProvider } from "./actionCentreProviders/dutyCrew";
import { noticesProvider } from "./actionCentreProviders/notices";
import type { ActionItem, ActionProvider, ProviderCtx } from "./actionCentreProviders/types";

// ─── Provider registry ────────────────────────────────────────────────────────

// Providers that raise a *member's* personal obligation are skipped for shared
// accounts - the DO phone has no availability, no skills profile and no RSVP.
// Duty-driven providers stay: they fire only on explicit assignment or an
// officer module the account would have to be deliberately granted.
const providers: Array<{ run: ActionProvider; membersOnly?: boolean }> = [
  { run: availabilityProvider, membersOnly: true },
  { run: profileProvider, membersOnly: true },
  { run: bookingApprovalsProvider },
  { run: eventRsvpProvider, membersOnly: true },
  { run: tasksProvider },
  { run: baSkillsLmsProvider },
  { run: dutyCrewProvider, membersOnly: true },
  // Notices are addressed to named recipients, so they're never a broadcast a
  // shared account could stumble into - no membersOnly gate needed.
  { run: noticesProvider },
];

// ─── Validators ───────────────────────────────────────────────────────────────

const actionItemValidator = v.object({
  id: v.string(),
  moduleId: v.string(),
  kind: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  url: v.string(),
  actionLabel: v.optional(v.string()),
  priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  count: v.optional(v.number()),
  createdAt: v.number(),
  meta: v.optional(v.any()),
  dismissible: v.optional(v.boolean()),
});

const rankValidator = v.union(
  v.literal("Brigade Member"),
  v.literal("Probationary"),
  v.literal("Firefighter"),
  v.literal("Lieutenant"),
  v.literal("Captain")
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RANK_ORDER: Record<string, number> = {
  "Brigade Member": 0,
  Probationary: 1,
  Firefighter: 2,
  Lieutenant: 3,
  Captain: 4,
};

async function requireSignedIn(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in");
  return userId;
}

export async function requireActionsAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await requireSignedIn(ctx);
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  if (user.isAdmin) return userId;

  const moduleSetting = await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", "actionsAdmin"))
    .first();

  if (!moduleSettingAllows(user, moduleSetting)) {
    throw new Error("You do not have access to manage tasks");
  }

  return userId;
}

function buildModuleAccessChecker(
  user: Doc<"users">,
  moduleMap: Map<string, Doc<"moduleSettings">>
): (moduleId: string) => boolean {
  if (user.isAdmin) return () => true;

  return (moduleId: string) => {
    return moduleSettingAllows(user, moduleMap.get(moduleId));
  };
}

function sortActions(actions: ActionItem[]): ActionItem[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...actions].sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return a.createdAt - b.createdAt;
  });
}

// ─── Public query: getMyActions ───────────────────────────────────────────────

export const getMyActions = query({
  args: {},
  returns: v.array(actionItemValidator),
  handler: async (ctx): Promise<ActionItem[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user) return [];

    const allModuleSettings = await ctx.db.query("moduleSettings").collect();
    const moduleMap = new Map(allModuleSettings.map((m) => [m.moduleId, m]));
    const hasModuleAccess = buildModuleAccessChecker(user, moduleMap);

    const providerCtx: ProviderCtx = { user, userId, hasModuleAccess };

    const active = isSharedAccount(user)
      ? providers.filter((p) => !p.membersOnly)
      : providers;

    const results = await Promise.all(
      active.map((p) => p.run(ctx, providerCtx).catch(() => [] as ActionItem[]))
    );

    // Dismissals are keyed on the action's stable id, so a derived action whose
    // id encodes a period (this week's duty reminder) comes back on its own when
    // the period rolls over and the id changes.
    const dismissed = new Set(
      (
        await ctx.db
          .query("actionDismissals")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(500)
      ).map((d) => d.actionId)
    );

    return sortActions(results.flat().filter((a) => !dismissed.has(a.id)));
  },
});

/**
 * Hide one action for the calling user. Only honours actions the provider marked
 * dismissible, so this can't be used to silence a genuine outstanding obligation.
 */
export const dismissAction = mutation({
  args: { actionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireSignedIn(ctx);

    const existing = await ctx.db
      .query("actionDismissals")
      .withIndex("by_user_and_action", (q) =>
        q.eq("userId", userId).eq("actionId", args.actionId)
      )
      .first();
    if (existing) return null;

    await ctx.db.insert("actionDismissals", {
      userId,
      actionId: args.actionId,
      dismissedAt: Date.now(),
    });

    return null;
  },
});

// ─── Task queries ─────────────────────────────────────────────────────────────

const taskWithNamesValidator = v.object({
  _id: v.id("actionTasks"),
  _creationTime: v.number(),
  title: v.string(),
  description: v.optional(v.string()),
  status: v.union(v.literal("open"), v.literal("completed"), v.literal("cancelled")),
  priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  dueDate: v.optional(v.string()),
  assignedUserIds: v.array(v.id("users")),
  assignedRoles: v.array(v.string()),
  minimumRank: v.optional(rankValidator),
  sourceModuleId: v.optional(v.string()),
  sourceEntityId: v.optional(v.string()),
  completedAt: v.optional(v.number()),
  completedBy: v.optional(v.id("users")),
  completionNotes: v.optional(v.string()),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdByName: v.optional(v.string()),
  completedByName: v.optional(v.string()),
  assignedUserNames: v.array(v.string()),
});

export const getTasks = query({
  args: { includeClosed: v.optional(v.boolean()) },
  returns: v.array(taskWithNamesValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let tasks;
    if (args.includeClosed) {
      tasks = await ctx.db.query("actionTasks").take(200);
    } else {
      tasks = await ctx.db
        .query("actionTasks")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .take(200);
    }

    const name = (u: Doc<"users"> | null) =>
      u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || u.email || "" : "";

    return Promise.all(
      tasks.map(async (task) => {
        const creator = task.createdBy ? await ctx.db.get(task.createdBy) : null;
        const completer = task.completedBy ? await ctx.db.get(task.completedBy) : null;
        const assignedUsers = await Promise.all(
          task.assignedUserIds.map((uid) => ctx.db.get(uid))
        );

        return {
          ...task,
          createdByName: name(creator),
          completedByName: completer ? name(completer) : undefined,
          assignedUserNames: assignedUsers.map(name),
        };
      })
    );
  },
});

export const getTaskById = query({
  args: { taskId: v.id("actionTasks") },
  returns: v.union(taskWithNamesValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    const name = (u: Doc<"users"> | null) =>
      u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || u.email || "" : "";

    const creator = task.createdBy ? await ctx.db.get(task.createdBy) : null;
    const completer = task.completedBy ? await ctx.db.get(task.completedBy) : null;
    const assignedUsers = await Promise.all(
      task.assignedUserIds.map((uid) => ctx.db.get(uid))
    );

    return {
      ...task,
      createdByName: name(creator),
      completedByName: completer ? name(completer) : undefined,
      assignedUserNames: assignedUsers.map(name),
    };
  },
});

// ─── Task mutations ───────────────────────────────────────────────────────────

export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    dueDate: v.optional(v.string()),
    assignedUserIds: v.array(v.id("users")),
    assignedRoles: v.array(v.string()),
    minimumRank: v.optional(rankValidator),
  },
  returns: v.id("actionTasks"),
  handler: async (ctx, args) => {
    const userId = await requireActionsAdmin(ctx);
    const now = Date.now();

    const taskId = await ctx.db.insert("actionTasks", {
      title: args.title,
      description: args.description,
      status: "open",
      priority: args.priority,
      dueDate: args.dueDate,
      assignedUserIds: args.assignedUserIds,
      assignedRoles: args.assignedRoles,
      minimumRank: args.minimumRank,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("actionTaskHistory", {
      taskId,
      timestamp: now,
      userId,
      changeType: "task_created",
      field: "status",
      oldValue: null,
      newValue: "open",
    });

    return taskId;
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("actionTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    dueDate: v.optional(v.string()),
    assignedUserIds: v.optional(v.array(v.id("users"))),
    assignedRoles: v.optional(v.array(v.string())),
    minimumRank: v.optional(rankValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireActionsAdmin(ctx);
    const { taskId, ...fields } = args;
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    const historyEntries: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    const t = task; // narrow for TS
    const candidates: Array<[string, unknown, unknown]> = [
      ["title", t.title, fields.title],
      ["description", t.description, fields.description],
      ["priority", t.priority, fields.priority],
      ["dueDate", t.dueDate, fields.dueDate],
      ["assignedUserIds", t.assignedUserIds, fields.assignedUserIds],
      ["assignedRoles", t.assignedRoles, fields.assignedRoles],
      ["minimumRank", t.minimumRank, fields.minimumRank],
    ];
    for (const [field, oldVal, newVal] of candidates) {
      if (newVal === undefined) continue;
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        patch[field] = newVal;
        historyEntries.push({ field, oldValue: oldVal, newValue: newVal });
      }
    }

    await ctx.db.patch(taskId, patch);

    for (const entry of historyEntries) {
      await ctx.db.insert("actionTaskHistory", {
        taskId,
        timestamp: now,
        userId,
        changeType: "field_change",
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
      });
    }

    return null;
  },
});

export const completeTask = mutation({
  args: {
    taskId: v.id("actionTasks"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireSignedIn(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== "open") throw new Error("Task is not open");

    const isAdmin = !!user.isAdmin;
    const isCreator = task.createdBy === userId;
    const hasNoAssignment =
      task.assignedUserIds.length === 0 &&
      task.assignedRoles.length === 0 &&
      !task.minimumRank;
    const matchesUser = task.assignedUserIds.includes(userId);
    const matchesRole = task.assignedRoles.some((r) => (user.roles ?? []).includes(r));
    const userRankOrder = user.rank ? (RANK_ORDER[user.rank] ?? 0) : 0;
    const matchesRank = task.minimumRank
      ? userRankOrder >= (RANK_ORDER[task.minimumRank] ?? 0)
      : false;

    if (!isAdmin && !isCreator && !hasNoAssignment && !matchesUser && !matchesRole && !matchesRank) {
      throw new Error("You are not assigned to this task");
    }

    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: "completed",
      completedAt: now,
      completedBy: userId,
      completionNotes: args.notes,
      updatedAt: now,
    });

    await ctx.db.insert("actionTaskHistory", {
      taskId: args.taskId,
      timestamp: now,
      userId,
      changeType: "task_completed",
      field: "status",
      oldValue: "open",
      newValue: "completed",
      notes: args.notes,
    });

    return null;
  },
});

export const reopenTask = mutation({
  args: { taskId: v.id("actionTasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireSignedIn(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.status !== "completed") throw new Error("Task is not completed");

    const isAdmin = !!user.isAdmin;
    const isCompleter = task.completedBy === userId;
    if (!isAdmin && !isCompleter) throw new Error("Only admins or the completer can reopen a task");

    const now = Date.now();
    await ctx.db.patch(args.taskId, {
      status: "open",
      completedAt: undefined,
      completedBy: undefined,
      completionNotes: undefined,
      updatedAt: now,
    });

    await ctx.db.insert("actionTaskHistory", {
      taskId: args.taskId,
      timestamp: now,
      userId,
      changeType: "task_reopened",
      field: "status",
      oldValue: "completed",
      newValue: "open",
    });

    return null;
  },
});

export const cancelTask = mutation({
  args: { taskId: v.id("actionTasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireActionsAdmin(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.status === "cancelled") return null;

    const now = Date.now();
    await ctx.db.patch(args.taskId, { status: "cancelled", updatedAt: now });

    await ctx.db.insert("actionTaskHistory", {
      taskId: args.taskId,
      timestamp: now,
      userId,
      changeType: "task_cancelled",
      field: "status",
      oldValue: task.status,
      newValue: "cancelled",
    });

    return null;
  },
});
