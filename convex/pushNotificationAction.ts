"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import webpush from "web-push";

// Configure web-push with VAPID keys from environment variables
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY as string | undefined;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY as string | undefined;

if (PUBLIC_KEY && PRIVATE_KEY) {
  webpush.setVapidDetails("mailto:no-reply@example.com", PUBLIC_KEY, PRIVATE_KEY);
}

export const sendNotification = action({
  args: {
    title: v.string(),
    body: v.string(),
    userId: v.optional(v.id("users")),
    url: v.optional(v.string()), // Optional URL for deep-linking when notification is clicked
    notificationType: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!PUBLIC_KEY || !PRIVATE_KEY) {
      throw new Error("VAPID keys are not configured on the server");
    }

    // Fetch subscriptions via internal query
    const subs = await ctx.runQuery(
      api.pushNotifications.getSubscriptions,
      args.userId ? { userId: args.userId } : { userId: undefined }
    );

    const payload = JSON.stringify({ 
      title: args.title, 
      body: args.body,
      ...(args.url && { url: args.url }) // Include URL if provided
    });

    const now = Date.now();
    const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours from now

    // Save notification to history for user retrieval
    // Collect recipient user IDs from subscriptions
    const recipientUserIds = args.userId 
      ? [args.userId] 
      : subs.length > 0 
        ? Array.from(new Set(subs.map(sub => sub.userId))) 
        : undefined;

    await ctx.runMutation(api.notificationHistory.createNotification, {
      title: args.title,
      body: args.body,
      url: args.url,
      notificationType: args.notificationType,
      source: args.source,
      sentAt: now,
      expiresAt,
      recipientUserIds,
    });

    if (subs.length === 0) {
      // Audit: no subscriptions found for this user
      await ctx.runMutation(api.notificationAudit.logAttempt, {
        userId: args.userId,
        subscriptionId: undefined,
        endpoint: undefined,
        notificationType: args.notificationType,
        source: args.source,
        title: args.title,
        body: args.body,
        success: false,
        error: "no_subscriptions",
        sentAt: now,
      });
      return;
    }

    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        // Audit success
        await ctx.runMutation(api.notificationAudit.logAttempt, {
          userId: sub.userId,
          subscriptionId: sub._id,
          endpoint: sub.subscription?.endpoint,
          notificationType: args.notificationType,
          source: args.source,
          title: args.title,
          body: args.body,
          success: true,
          sentAt: now,
        });
      } catch (err: any) {
        // Clean up stale subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await ctx.runMutation(api.pushNotifications.deleteSubscription, {
            id: sub._id,
          });
        }
        // Audit failure
        await ctx.runMutation(api.notificationAudit.logAttempt, {
          userId: sub.userId,
          subscriptionId: sub._id,
          endpoint: sub.subscription?.endpoint,
          notificationType: args.notificationType,
          source: args.source,
          title: args.title,
          body: args.body,
          success: false,
          error: typeof err?.message === "string" ? err.message : String(err),
          sentAt: now,
        });
      }
    }
  },
});
