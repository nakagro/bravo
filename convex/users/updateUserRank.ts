import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Update a user's rank
 */
export const updateUserRank = mutation({
  args: {
    userId: v.id("users"),
    rank: v.union(
      v.literal("Probationary"),
      v.literal("Firefighter"),
      v.literal("Lieutenant"),
      v.literal("Captain")
    ),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const { userId, rank } = args;
    
    // Verify the user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Update the user's rank
    await ctx.db.patch(userId, { rank });
    
    return userId;
  },
});
