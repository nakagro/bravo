import { query } from "../_generated/server";
import { v } from "convex/values";

export const getStatuses = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.string(),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      memberNumber: v.optional(v.string()),
      currentStatus: v.optional(
        v.union(
          v.literal("available"),
          v.literal("not available"),
          v.literal("delayed response"),
          v.literal("WFH")
        )
      ),
      statusUpdatedAt: v.optional(v.number()),
      isDutyOfficer: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    // Map users to the format we need
    return users.map((user) => ({
      _id: user._id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      memberNumber: user.memberNumber,
      currentStatus: user.currentStatus,
      statusUpdatedAt: user.statusUpdatedAt,
      isDutyOfficer: user.isDutyOfficer,
    }));
  },
});

export const getDutyOfficer = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.string(),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const dutyOfficer = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDutyOfficer"), true))
      .first();
    
    if (!dutyOfficer) {
      return null;
    }
    
    return {
      _id: dutyOfficer._id,
      name: dutyOfficer.name,
      firstName: dutyOfficer.firstName,
      lastName: dutyOfficer.lastName,
    };
  },
});

export const getCurrentUserStatus = query({
  args: {},
  returns: v.object({
    currentStatus: v.optional(
      v.union(
        v.literal("available"),
        v.literal("not available"),
        v.literal("delayed response"),
        v.literal("WFH")
      )
    ),
    statusUpdatedAt: v.optional(v.number()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return {
      currentStatus: user.currentStatus,
      statusUpdatedAt: user.statusUpdatedAt,
    };
  },
});
