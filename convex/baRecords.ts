import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";

const usageTypeValidator = v.union(
  v.literal("firecall"),
  v.literal("drill"),
);

const BA_RECORD_DELETE_WINDOW_MS = 15 * 60 * 1000;
const RANK_ORDER = {
  Probationary: 1,
  Firefighter: 2,
  Lieutenant: 3,
  Captain: 4,
} as const;

const recordReturnValidator = v.object({
  _id: v.id("baRecords"),
  _creationTime: v.number(),
  memberId: v.id("users"),
  memberName: v.string(),
  dateUsed: v.string(),
  durationMinutes: v.number(),
  usageType: usageTypeValidator,
  notes: v.string(),
  verifiedBy: v.id("users"),
  verifierName: v.string(),
  submittedBy: v.id("users"),
  submitterName: v.string(),
  submittedOnBehalf: v.boolean(),
  lmsEnteredAt: v.optional(v.number()),
  lmsEnteredBy: v.optional(v.id("users")),
  lmsEnteredByName: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function userDisplayName(user: Doc<"users"> | null | undefined): string {
  if (!user) return "Unknown";
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return full || user.name || "Unknown";
}

async function decorateRecord(ctx: QueryCtx, record: Doc<"baRecords">) {
  const [member, verifier, submitter, lmsEnteredBy] = await Promise.all([
    ctx.db.get(record.memberId),
    ctx.db.get(record.verifiedBy),
    ctx.db.get(record.submittedBy),
    record.lmsEnteredBy ? ctx.db.get(record.lmsEnteredBy) : Promise.resolve(null),
  ]);
  return {
    ...record,
    memberName: userDisplayName(member),
    verifierName: userDisplayName(verifier),
    submitterName: userDisplayName(submitter),
    lmsEnteredByName: record.lmsEnteredBy ? userDisplayName(lmsEnteredBy) : undefined,
  };
}

async function userHasModuleAccess(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  moduleId: string,
) {
  if (user.isAdmin) return true;

  const moduleSetting = await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
    .first();

  if (!moduleSetting || !moduleSetting.isEnabled) return false;
  if (moduleSetting.adminOnly && !user.isAdmin) return false;

  const requiredRoles = moduleSetting.requiredRoles ?? [];
  const roleOk =
    requiredRoles.length === 0 || requiredRoles.some((role) => (user.roles ?? []).includes(role));

  const requiredRank = moduleSetting.minimumRank;
  const rankOk =
    requiredRank === undefined ||
    (user.rank !== undefined && RANK_ORDER[user.rank] >= RANK_ORDER[requiredRank]);

  return roleOk && rankOk;
}

/**
 * List BA records. If `memberId` is provided, restrict to that member's records.
 */
export const listRecords = query({
  args: {
    memberId: v.optional(v.id("users")),
  },
  returns: v.array(recordReturnValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const records = args.memberId
      ? await ctx.db
          .query("baRecords")
          .withIndex("by_member_date", (q) => q.eq("memberId", args.memberId!))
          .order("desc")
          .collect()
      : await ctx.db
          .query("baRecords")
          .withIndex("by_createdAt")
          .order("desc")
          .collect();

    return Promise.all(records.map((r) => decorateRecord(ctx, r)));
  },
});

/**
 * List the current user's BA records (most recent first).
 */
export const listMyRecords = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(recordReturnValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const records = await ctx.db
      .query("baRecords")
      .withIndex("by_member_date", (q) => q.eq("memberId", userId))
      .order("desc")
      .take(args.limit ?? 5);

    return Promise.all(records.map((r) => decorateRecord(ctx, r)));
  },
});

/**
 * Create a BA record. Verifier is required and must differ from the member.
 */
export const createRecord = mutation({
  args: {
    memberId: v.id("users"),
    dateUsed: v.string(),
    durationMinutes: v.number(),
    usageType: usageTypeValidator,
    notes: v.string(),
    verifiedBy: v.id("users"),
  },
  returns: v.id("baRecords"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to log BA usage");

    if (args.durationMinutes < 1 || args.durationMinutes > 480) {
      throw new Error("Duration must be between 1 and 480 minutes");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.dateUsed)) {
      throw new Error("Invalid date format");
    }
    if (args.verifiedBy === args.memberId) {
      throw new Error("Verifier must be a different member");
    }
    const trimmedNotes = args.notes.trim();
    if (trimmedNotes.length === 0) {
      throw new Error("Notes are required");
    }

    const now = Date.now();
    const submittedOnBehalf = args.memberId !== userId;

    return await ctx.db.insert("baRecords", {
      memberId: args.memberId,
      dateUsed: args.dateUsed,
      durationMinutes: args.durationMinutes,
      usageType: args.usageType,
      notes: trimmedNotes,
      verifiedBy: args.verifiedBy,
      submittedBy: userId,
      submittedOnBehalf,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing record. Submitter or admin only.
 */
export const updateRecord = mutation({
  args: {
    recordId: v.id("baRecords"),
    memberId: v.optional(v.id("users")),
    dateUsed: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    usageType: v.optional(usageTypeValidator),
    notes: v.optional(v.string()),
    verifiedBy: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to update a record");

    const record = await ctx.db.get(args.recordId);
    if (!record) throw new Error("Record not found");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    if (record.submittedBy !== userId && !user.isAdmin) {
      throw new Error("You can only edit records you submitted");
    }

    const memberId = args.memberId ?? record.memberId;
    const verifiedBy = args.verifiedBy ?? record.verifiedBy;
    if (verifiedBy === memberId) {
      throw new Error("Verifier must be a different member");
    }

    if (args.durationMinutes !== undefined) {
      if (args.durationMinutes < 1 || args.durationMinutes > 480) {
        throw new Error("Duration must be between 1 and 480 minutes");
      }
    }
    if (args.dateUsed !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(args.dateUsed)) {
      throw new Error("Invalid date format");
    }

    const updates: Partial<Doc<"baRecords">> = { updatedAt: Date.now() };
    if (args.memberId !== undefined) {
      updates.memberId = args.memberId;
      updates.submittedOnBehalf = args.memberId !== record.submittedBy;
    }
    if (args.dateUsed !== undefined) updates.dateUsed = args.dateUsed;
    if (args.durationMinutes !== undefined) updates.durationMinutes = args.durationMinutes;
    if (args.usageType !== undefined) updates.usageType = args.usageType;
    if (args.notes !== undefined) {
      const trimmed = args.notes.trim();
      if (trimmed.length === 0) throw new Error("Notes are required");
      updates.notes = trimmed;
    }
    if (args.verifiedBy !== undefined) updates.verifiedBy = args.verifiedBy;

    await ctx.db.patch(args.recordId, updates);
    return null;
  },
});

/**
 * Delete a record. BA Skills admin can delete any record; submitters can delete recent entries.
 */
export const deleteRecord = mutation({
  args: { recordId: v.id("baRecords") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to delete a record");

    const record = await ctx.db.get(args.recordId);
    if (!record) throw new Error("Record not found");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const canManageBARecords = await userHasModuleAccess(ctx, user, "baSkillsAdmin");

    if (record.submittedBy !== userId && !canManageBARecords) {
      throw new Error("You can only delete records you submitted");
    }
    if (!canManageBARecords && Date.now() - record.createdAt > BA_RECORD_DELETE_WINDOW_MS) {
      throw new Error("BA records can only be deleted within 15 minutes of being entered");
    }

    await ctx.db.delete(args.recordId);
    return null;
  },
});

/**
 * Mark whether a BA usage record has been entered into CFA LMS. BA Skills admin only.
 */
export const setLmsEntered = mutation({
  args: {
    recordId: v.id("baRecords"),
    entered: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to update LMS status");

    const record = await ctx.db.get(args.recordId);
    if (!record) throw new Error("Record not found");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const canManageBARecords = await userHasModuleAccess(ctx, user, "baSkillsAdmin");
    if (!canManageBARecords) {
      throw new Error("BA Skills admin access required");
    }

    const now = Date.now();
    await ctx.db.patch(args.recordId, {
      lmsEnteredAt: args.entered ? now : undefined,
      lmsEnteredBy: args.entered ? userId : undefined,
      updatedAt: now,
    });
    return null;
  },
});

/**
 * List members for member/verifier dropdowns.
 */
export const listMembers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      rank: v.optional(
        v.union(
          v.literal("Probationary"),
          v.literal("Firefighter"),
          v.literal("Lieutenant"),
          v.literal("Captain"),
        ),
      ),
      skills: v.array(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const [users, skills] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("skills").collect(),
    ]);
    const skillMap = new Map(skills.map((skill) => [skill._id, skill.code]));

    return users
      .filter((u) => !u.isAnonymous && (u.firstName || u.lastName || u.name))
      .map((u) => ({
        _id: u._id,
        name: userDisplayName(u),
        firstName: u.firstName,
        lastName: u.lastName,
        rank: u.rank,
        skills: (u.skills ?? [])
          .map((skillId) => skillMap.get(skillId))
          .filter((code): code is string => Boolean(code)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Current user shorthand for the form.
 */
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: userDisplayName(user),
      firstName: user.firstName,
      lastName: user.lastName,
    };
  },
});
