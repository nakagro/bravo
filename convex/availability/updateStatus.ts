import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const updateUserStatus = mutation({
  args: {
    status: v.union(
      v.literal("available - station"),
      v.literal("available - satellite"),
      v.literal("not available"),
      v.literal("delayed response"),
      v.literal("WFH")
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Find the user
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Update the user's status
    const now = Date.now();
    await ctx.db.patch(user._id, {
      currentStatus: args.status,
      statusUpdatedAt: now,
    });
    
    // Record status change in history
    await ctx.db.insert("memberStatusHistory", {
      userId: user._id,
      status: args.status,
      timestamp: now,
    });
    
    return true;
  },
});

export const setDutyOfficer = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
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
