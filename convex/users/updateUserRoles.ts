import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Update a user's roles
 */
export const updateUserRoles = mutation({
  args: {
    userId: v.id("users"),
    roles: v.array(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const { userId, roles } = args;
    
    // Verify the user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Update the user's roles
    await ctx.db.patch(userId, { roles });
    
    return userId;
  },
});
