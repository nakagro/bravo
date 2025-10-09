import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Node-specific `web-push` code has been moved to `pushNotificationAction.ts`.

// Store or update a push subscription for the current user
export const register = mutation({
  args: {
    subscription: v.any(), // Raw PushSubscription JSON
    deviceType: v.optional(v.union(v.literal("mobile"), v.literal("tablet"), v.literal("desktop"))),
    platform: v.optional(v.string()),
    browser: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if a subscription already exists for this user
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        subscription: args.subscription,
        deviceType: args.deviceType,
        platform: args.platform,
        browser: args.browser,
        userAgent: args.userAgent,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("pushSubscriptions", {
        userId,
        subscription: args.subscription,
        deviceType: args.deviceType,
        platform: args.platform,
        browser: args.browser,
        userAgent: args.userAgent,
        createdAt: Date.now(),
      });
    }

    return null;
  },
});

// sendNotification moved to pushNotificationAction.ts

export const getSubscriptions = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (args.userId) {
      return await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user", (q: any) => q.eq("userId", args.userId!))
        .collect();
    }
    return await ctx.db.query("pushSubscriptions").collect();
  },
});

export const deleteSubscription = mutation({
  args: { id: v.id("pushSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});
