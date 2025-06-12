import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// Get all user statuses, resetting at 4am each day
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
    // Calculate the timestamp for 4am of the current day
    const now = new Date();
    const today4am = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      4, // 4am
      0, // 0 minutes
      0, // 0 seconds
      0 // 0 milliseconds
    ).getTime();
    
    // If current time is before 4am, use 4am from the previous day
    const cutoffTime = now.getHours() < 4 ? 
      today4am - 24 * 60 * 60 * 1000 : // Subtract one day if before 4am
      today4am;
      
    const users = await ctx.db.query("users").collect();
    
    // Map users to the format we need, but reset status if it was updated before the cutoff time
    return users.map((user) => {
      // Check if the status was updated after the cutoff time
      const isStatusCurrent = user.statusUpdatedAt && user.statusUpdatedAt >= cutoffTime;
      
      return {
        _id: user._id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        memberNumber: user.memberNumber,
        // Only include currentStatus if it was updated after the cutoff time
        currentStatus: isStatusCurrent ? user.currentStatus : undefined,
        statusUpdatedAt: isStatusCurrent ? user.statusUpdatedAt : undefined,
        isDutyOfficer: user.isDutyOfficer,
      };
    });
  },
});

// Raw query returning users' status fields without any cutoff/reset logic.
export const getAllUsersStatus = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      currentStatus: v.optional(
        v.union(
          v.literal("available"),
          v.literal("not available"),
          v.literal("delayed response"),
          v.literal("WFH")
        )
      ),
      statusUpdatedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      currentStatus: u.currentStatus,
      statusUpdatedAt: u.statusUpdatedAt,
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

// Clear a user's status (internal helper)
export const clearStatus = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      currentStatus: undefined,
      statusUpdatedAt: undefined,
    });
    return null;
  },
});
