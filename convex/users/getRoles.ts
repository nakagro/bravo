import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get all roles from the system
 */
export const getRoles = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("roles"),
      name: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("roles").collect();
  },
});
