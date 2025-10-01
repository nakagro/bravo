import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Node-specific `web-push` code has been moved to `pushNotificationAction.ts`.

// Store or update a push subscription for the current user
export const register = mutation({
  args: {
    subscription: v.any(), // Raw PushSubscription JSON
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
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("pushSubscriptions", {
        userId,
        subscription: args.subscription,
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

// Get current user's push subscriptions
export const getMySubscriptions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("pushSubscriptions"),
      _creationTime: v.number(),
      subscription: v.any(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();

    return subscriptions.map((sub) => ({
      _id: sub._id,
      _creationTime: sub._creationTime,
      subscription: sub.subscription,
      createdAt: sub.createdAt,
    }));
  },
});

// Delete a subscription (only if it belongs to the current user)
export const deleteMySubscription = mutation({
  args: { id: v.id("pushSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify the subscription belongs to the current user
    const subscription = await ctx.db.get(args.id);
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.userId !== userId) {
      throw new Error("You can only delete your own subscriptions");
    }

    await ctx.db.delete(args.id);
    return null;
  },
});
