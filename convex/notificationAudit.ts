import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const logAttempt = mutation({
  args: {
    userId: v.optional(v.id("users")),
    subscriptionId: v.optional(v.id("pushSubscriptions")),
    endpoint: v.optional(v.string()),
    notificationType: v.optional(v.string()),
    source: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
    sentAt: v.number(),
  },
  returns: v.id("notificationAudit"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("notificationAudit", args);
  },
});

export const recentByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("notificationAudit"),
    userId: v.optional(v.id("users")),
    subscriptionId: v.optional(v.id("pushSubscriptions")),
    endpoint: v.optional(v.string()),
    notificationType: v.optional(v.string()),
    source: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
    sentAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("notificationAudit")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    return items.slice(0, args.limit ?? 100);
  },
});
