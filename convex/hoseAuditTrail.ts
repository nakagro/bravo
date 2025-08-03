import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getRecentChanges = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("hoseHistory"),
    _creationTime: v.number(),
    hoseId: v.id("hoses"),
    timestamp: v.number(),
    userId: v.id("users"),
    changeType: v.string(),
    field: v.string(),
    oldValue: v.any(),
    newValue: v.any(),
    notes: v.optional(v.string()),
    userName: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    hoseIdString: v.string(),
  })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const limit = args.limit || 20;

    // Get recent hose history entries
    const historyEntries = await ctx.db
      .query("hoseHistory")
      .order("desc")
      .take(limit);

    // Enrich with user information and get hose details
    const enrichedEntries = await Promise.all(
      historyEntries.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        const hose = await ctx.db.get(entry.hoseId);
        return {
          ...entry,
          userName: user?.name,
          userEmail: user?.email,
          hoseIdString: hose?.hoseId || 'Unknown',
        };
      })
    );

    return enrichedEntries;
  },
});
