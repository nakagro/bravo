import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Create a new notification history entry
 * This is called by the push notification action to store notifications for 24 hours
 */
export const createNotification = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
    notificationType: v.optional(v.string()),
    source: v.optional(v.string()),
    sentAt: v.number(),
    expiresAt: v.number(),
    recipientUserIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.id("notificationHistory"),
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notificationHistory", {
      title: args.title,
      body: args.body,
      url: args.url,
      notificationType: args.notificationType,
      source: args.source,
      sentAt: args.sentAt,
      expiresAt: args.expiresAt,
      recipientUserIds: args.recipientUserIds,
    });

    return notificationId;
  },
});

/**
 * Get recent notifications for the current user (within last 24 hours)
 * Returns notifications that:
 * 1. Were sent to this specific user (recipientUserIds includes user), OR
 * 2. Were broadcast to all users (recipientUserIds is undefined/empty)
 */
export const getRecentNotifications = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("notificationHistory"),
      title: v.string(),
      body: v.string(),
      url: v.optional(v.string()),
      notificationType: v.optional(v.string()),
      source: v.optional(v.string()),
      sentAt: v.number(),
      expiresAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const now = Date.now();

    // Get all notifications that haven't expired yet
    const allNotifications = await ctx.db
      .query("notificationHistory")
      .withIndex("by_sentAt")
      .order("desc")
      .collect();

    // Filter notifications for this user:
    // - Broadcast notifications (no recipientUserIds or empty array)
    // - Targeted notifications where this user is a recipient
    const userNotifications = allNotifications.filter((notification) => {
      // Skip expired notifications
      if (notification.expiresAt < now) {
        return false;
      }

      // Include broadcast notifications (no recipients specified)
      if (!notification.recipientUserIds || notification.recipientUserIds.length === 0) {
        return true;
      }

      // Include if user is in the recipient list
      return notification.recipientUserIds.includes(userId);
    });

    return userNotifications;
  },
});

/**
 * Delete expired notifications (older than 24 hours)
 * This should be called periodically via a cron job
 */
export const cleanupExpiredNotifications = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();

    // Find all expired notifications
    const expiredNotifications = await ctx.db
      .query("notificationHistory")
      .withIndex("by_expiresAt")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    // Delete each expired notification
    for (const notification of expiredNotifications) {
      await ctx.db.delete(notification._id);
    }

    return expiredNotifications.length;
  },
});

/**
 * Manual cleanup function for admins
 * Deletes all expired notifications and returns count
 */
export const manualCleanup = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new Error("Only admins can manually cleanup notifications");
    }

    const now = Date.now();

    // Find all expired notifications
    const expiredNotifications = await ctx.db
      .query("notificationHistory")
      .withIndex("by_expiresAt")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    // Delete each expired notification
    for (const notification of expiredNotifications) {
      await ctx.db.delete(notification._id);
    }

    return expiredNotifications.length;
  },
});
