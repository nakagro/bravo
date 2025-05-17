import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get all users from the system
 */
export const getUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      email: v.optional(v.string()),
      memberNumber: v.optional(v.string()),
      rank: v.optional(
        v.union(
          v.literal("Probationary"),
          v.literal("Firefighter"),
          v.literal("Lieutenant"),
          v.literal("Captain")
        )
      ),
      roles: v.optional(v.array(v.string())),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});
