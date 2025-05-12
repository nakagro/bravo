import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get all user statuses
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

// Get the current duty officer
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

// Get current user's status
export const getCurrentUserStatus = query({
  args: {},
  returns: v.union(
    v.object({
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
    v.null()
  ),
  handler: async (ctx) => {
    // Get the authenticated user ID using the same pattern as other functions
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null; // Return null if not authenticated
    }
    
    // Get the current user data directly using the ID
    const user = await ctx.db.get(userId);
    
    if (!user) {
      return null; // Return null if user not found
    }
    
    return {
      currentStatus: user.currentStatus,
      statusUpdatedAt: user.statusUpdatedAt,
    };
  },
});

// Update user status
export const updateUserStatus = mutation({
  args: {
    status: v.union(
      v.literal("available"),
      v.literal("not available"),
      v.literal("delayed response"),
      v.literal("WFH")
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Get the authenticated user ID using the same pattern as other mutations
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update your status");
    }
    
    // Get the current user data directly using the ID
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Update the user's status
    const now = Date.now();
    await ctx.db.patch(userId, {
      currentStatus: args.status,
      statusUpdatedAt: now,
    });
    
    // Record status change in history
    await ctx.db.insert("memberStatusHistory", {
      userId: userId,
      status: args.status,
      timestamp: now,
    });
    
    return true;
  },
});

// Set duty officer
export const setDutyOfficer = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Get the authenticated user ID using the same pattern as other mutations
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("You must be signed in to set a duty officer");
    }
    
    // Find current duty officer if any
    const currentDutyOfficer = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDutyOfficer"), true))
      .first();
    
    // If there is a current duty officer, update their record
    if (currentDutyOfficer) {
      await ctx.db.patch(currentDutyOfficer._id, {
        isDutyOfficer: false,
      });
      
      // Find the most recent duty officer history record for this user
      const dutyHistory = await ctx.db
        .query("dutyOfficerHistory")
        .filter((q) => q.eq(q.field("userId"), currentDutyOfficer._id))
        .order("desc")
        .first();
      
      // Update the end time if a record exists
      if (dutyHistory && !dutyHistory.endTimestamp) {
        await ctx.db.patch(dutyHistory._id, {
          endTimestamp: Date.now(),
        });
      }
    }
    
    // Set the new duty officer
    await ctx.db.patch(args.userId, {
      isDutyOfficer: true,
    });
    
    // Create a new duty officer history record
    await ctx.db.insert("dutyOfficerHistory", {
      userId: args.userId,
      startTimestamp: Date.now(),
    });
    
    return true;
  },
});
