import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Node-specific `web-push` code has been moved to `pushNotificationAction.ts`.

// Store or update a push subscription for the current user.
// Keyed on (userId, subscription.endpoint) rather than just userId, so a
// user can be registered on multiple devices at once without one device's
// registration overwriting another's.
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

    const endpoint = args.subscription?.endpoint;

    // Check if this exact device (by endpoint) already has a subscription
    const existingForUser = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    const existing = existingForUser.find((sub) => sub.subscription?.endpoint === endpoint);

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

// Internal-only: raw subscriptions (including push keys) for the calling
// user, for use by pushNotificationAction's self-test sender. Never exposed
// to the client directly - use getMySubscriptions for that.
export const getMySubscriptionsRaw = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("pushSubscriptions"),
      userId: v.id("users"),
      subscription: v.any(),
      deviceType: v.optional(v.union(v.literal("mobile"), v.literal("tablet"), v.literal("desktop"))),
      platform: v.optional(v.string()),
      browser: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return subs.map((sub) => ({
      _id: sub._id,
      userId: sub.userId,
      subscription: sub.subscription,
      deviceType: sub.deviceType,
      platform: sub.platform,
      browser: sub.browser,
    }));
  },
});

// Self-service: list only the current user's own registered devices, for the
// user settings page (as opposed to getSubscriptions, which is used by admin
// tooling and can list any/all users' subscriptions).
export const getMySubscriptions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("pushSubscriptions"),
      deviceType: v.optional(v.union(v.literal("mobile"), v.literal("tablet"), v.literal("desktop"))),
      platform: v.optional(v.string()),
      browser: v.optional(v.string()),
      createdAt: v.number(),
      endpoint: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return subs.map((sub) => ({
      _id: sub._id,
      deviceType: sub.deviceType,
      platform: sub.platform,
      browser: sub.browser,
      createdAt: sub.createdAt,
      endpoint: sub.subscription?.endpoint,
    }));
  },
});

// Self-service: remove one of the current user's own registered devices.
// Verifies ownership server-side so a user can't delete another user's
// subscription by guessing/passing an arbitrary id.
export const deleteMySubscription = mutation({
  args: { id: v.id("pushSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sub = await ctx.db.get(args.id);
    if (!sub || sub.userId !== userId) {
      throw new Error("Subscription not found");
    }

    await ctx.db.delete(args.id);
    return null;
  },
});
