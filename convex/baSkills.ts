import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get all BA skills records with member and verifier details
 */
export const getBASkillsRecords = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("baSkillsRecords"),
      _creationTime: v.number(),
      memberId: v.id("users"),
      memberName: v.string(),
      dateUsed: v.string(),
      durationMinutes: v.number(),
      usageType: v.union(v.literal("firecall"), v.literal("drill")),
      location: v.string(),
      verifiedBy: v.optional(v.id("users")),
      verifierName: v.optional(v.string()),
      submittedBy: v.id("users"),
      submitterName: v.string(),
      submittedOnBehalf: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const records = await ctx.db
      .query("baSkillsRecords")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    const recordsWithDetails = await Promise.all(
      records.map(async (record) => {
        const member = await ctx.db.get(record.memberId);
        const submitter = await ctx.db.get(record.submittedBy);
        const verifier = record.verifiedBy
          ? await ctx.db.get(record.verifiedBy)
          : null;

        return {
          ...record,
          memberName: member
            ? `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
              member.name ||
              "Unknown"
            : "Unknown",
          submitterName: submitter
            ? `${submitter.firstName || ""} ${submitter.lastName || ""}`.trim() ||
              submitter.name ||
              "Unknown"
            : "Unknown",
          verifierName: verifier
            ? `${verifier.firstName || ""} ${verifier.lastName || ""}`.trim() ||
              verifier.name ||
              undefined
            : undefined,
        };
      })
    );

    return recordsWithDetails;
  },
});

/**
 * Get BA skills records for a specific member
 */
export const getBASkillsRecordsByMember = query({
  args: {
    memberId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("baSkillsRecords"),
      _creationTime: v.number(),
      memberId: v.id("users"),
      memberName: v.string(),
      dateUsed: v.string(),
      durationMinutes: v.number(),
      usageType: v.union(v.literal("firecall"), v.literal("drill")),
      location: v.string(),
      verifiedBy: v.optional(v.id("users")),
      verifierName: v.optional(v.string()),
      submittedBy: v.id("users"),
      submitterName: v.string(),
      submittedOnBehalf: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const records = await ctx.db
      .query("baSkillsRecords")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .order("desc")
      .collect();

    const recordsWithDetails = await Promise.all(
      records.map(async (record) => {
        const member = await ctx.db.get(record.memberId);
        const submitter = await ctx.db.get(record.submittedBy);
        const verifier = record.verifiedBy
          ? await ctx.db.get(record.verifiedBy)
          : null;

        return {
          ...record,
          memberName: member
            ? `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
              member.name ||
              "Unknown"
            : "Unknown",
          submitterName: submitter
            ? `${submitter.firstName || ""} ${submitter.lastName || ""}`.trim() ||
              submitter.name ||
              "Unknown"
            : "Unknown",
          verifierName: verifier
            ? `${verifier.firstName || ""} ${verifier.lastName || ""}`.trim() ||
              verifier.name ||
              undefined
            : undefined,
        };
      })
    );

    return recordsWithDetails;
  },
});

/**
 * Create a new BA skills record
 */
export const createBASkillsRecord = mutation({
  args: {
    memberId: v.id("users"),
    dateUsed: v.string(),
    durationMinutes: v.number(),
    usageType: v.union(v.literal("firecall"), v.literal("drill")),
    location: v.string(),
    verifiedBy: v.optional(v.id("users")),
  },
  returns: v.id("baSkillsRecords"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to create a BA skills record");
    }

    const now = Date.now();
    const submittedOnBehalf = args.memberId !== userId;

    const recordId = await ctx.db.insert("baSkillsRecords", {
      memberId: args.memberId,
      dateUsed: args.dateUsed,
      durationMinutes: args.durationMinutes,
      usageType: args.usageType,
      location: args.location,
      verifiedBy: args.verifiedBy,
      submittedBy: userId,
      submittedOnBehalf,
      createdAt: now,
      updatedAt: now,
    });

    return recordId;
  },
});

/**
 * Update an existing BA skills record
 */
export const updateBASkillsRecord = mutation({
  args: {
    recordId: v.id("baSkillsRecords"),
    memberId: v.optional(v.id("users")),
    dateUsed: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    usageType: v.optional(v.union(v.literal("firecall"), v.literal("drill"))),
    location: v.optional(v.string()),
    verifiedBy: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update a BA skills record");
    }

    const record = await ctx.db.get(args.recordId);
    if (!record) {
      throw new Error("Record not found");
    }

    // Check if user is the submitter or an admin
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (record.submittedBy !== userId && !user.isAdmin) {
      throw new Error("You can only edit records you submitted");
    }

    const updates: Partial<typeof record> = {
      updatedAt: Date.now(),
    };

    if (args.memberId !== undefined) {
      updates.memberId = args.memberId;
      updates.submittedOnBehalf = args.memberId !== record.submittedBy;
    }
    if (args.dateUsed !== undefined) updates.dateUsed = args.dateUsed;
    if (args.durationMinutes !== undefined)
      updates.durationMinutes = args.durationMinutes;
    if (args.usageType !== undefined) updates.usageType = args.usageType;
    if (args.location !== undefined) updates.location = args.location;
    if (args.verifiedBy !== undefined) updates.verifiedBy = args.verifiedBy;

    await ctx.db.patch(args.recordId, updates);
    return null;
  },
});

/**
 * Delete a BA skills record
 */
export const deleteBASkillsRecord = mutation({
  args: {
    recordId: v.id("baSkillsRecords"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to delete a BA skills record");
    }

    const record = await ctx.db.get(args.recordId);
    if (!record) {
      throw new Error("Record not found");
    }

    // Check if user is the submitter or an admin
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (record.submittedBy !== userId && !user.isAdmin) {
      throw new Error("You can only delete records you submitted");
    }

    await ctx.db.delete(args.recordId);
    return null;
  },
});

/**
 * Get all members for the member selector dropdown
 */
export const getAllMembers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const users = await ctx.db.query("users").collect();

    // Filter out anonymous users and format the response
    return users
      .filter((user) => !user.isAnonymous && (user.firstName || user.lastName || user.name))
      .map((user) => ({
        _id: user._id,
        name:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          user.name ||
          "Unknown",
        firstName: user.firstName,
        lastName: user.lastName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get the current user's ID and name
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
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      name:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.name ||
        "Unknown",
      firstName: user.firstName,
      lastName: user.lastName,
    };
  },
});
