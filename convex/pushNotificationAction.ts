"use node";

import { action, internalAction, ActionCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import webpush from "web-push";
import { getAuthUserId } from "@convex-dev/auth/server";
import { trackNotificationDelivery } from "./posthogAnalytics";

// Configure web-push with VAPID keys from environment variables
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY as string | undefined;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY as string | undefined;

if (PUBLIC_KEY && PRIVATE_KEY) {
  webpush.setVapidDetails("mailto:no-reply@example.com", PUBLIC_KEY, PRIVATE_KEY);
}

type Message = {
  title: string;
  body: string;
  url?: string;
  notificationType?: string;
  source?: string;
};

/**
 * The one push path: applies prefs and the module gate, sends to each
 * subscription, audits every attempt and prunes dead subscriptions. History is
 * the caller's job (a broadcast writes one row, a targeted send one per member).
 */
async function pushToSubscriptions(
  ctx: ActionCtx,
  subs: any[],
  message: Message,
  /** Who the message was meant for, so "no device" can be audited per member. */
  intendedUserIds: Id<"users">[] | undefined,
) {
  const now = Date.now();
  const audit = (entry: {
    userId?: Id<"users">;
    sub?: any;
    success: boolean;
    error?: string;
  }) =>
    ctx.runMutation(api.notificationAudit.logAttempt, {
      userId: entry.userId,
      subscriptionId: entry.sub?._id,
      endpoint: entry.sub?.subscription?.endpoint,
      notificationType: message.notificationType,
      source: message.source,
      title: message.title,
      body: message.body,
      success: entry.success,
      error: entry.error,
      sentAt: now,
    });
  const track = (userId: Id<"users">, success: boolean, error: string | undefined, sub?: any) =>
    trackNotificationDelivery({
      userId,
      notificationType: message.notificationType,
      source: message.source,
      title: message.title,
      success,
      error,
      hasSubscription: !!sub,
      deviceType: sub?.deviceType,
      platform: sub?.platform,
      browser: sub?.browser,
    });

  // Respect each member's preferences and module access.
  const candidates = Array.from(
    new Set([...(intendedUserIds ?? []), ...subs.map((sub: any) => sub.userId as Id<"users">)])
  );
  const blocked = new Map(
    (
      await ctx.runQuery(internal.notificationPrefs.pushBlockedUsers, {
        userIds: candidates,
        notificationType: message.notificationType,
      })
    ).map((b) => [b.userId, b.reason])
  );
  for (const [userId, reason] of blocked) {
    await audit({ userId, success: false, error: reason });
  }

  // Members the message was meant for who have no device at all.
  const withDevice = new Set(subs.map((sub: any) => sub.userId));
  for (const userId of intendedUserIds ?? []) {
    if (blocked.has(userId) || withDevice.has(userId)) continue;
    await audit({ userId, success: false, error: "no_subscriptions" });
    await track(userId, false, "no_subscriptions");
  }

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    ...(message.url && { url: message.url }),
  });

  for (const sub of subs.filter((sub: any) => !blocked.has(sub.userId))) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      await audit({ userId: sub.userId, sub, success: true });
      await track(sub.userId, true, undefined, sub);
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await ctx.runMutation(api.pushNotifications.deleteSubscription, { id: sub._id });
      }
      const errorMessage = typeof err?.message === "string" ? err.message : String(err);
      await audit({ userId: sub.userId, sub, success: false, error: errorMessage });
      await track(sub.userId, false, errorMessage, sub);
    }
  }
}

async function writeHistory(ctx: ActionCtx, message: Message, recipientUserIds?: Id<"users">[]) {
  const now = Date.now();
  await ctx.runMutation(api.notificationHistory.createNotification, {
    title: message.title,
    body: message.body,
    url: message.url,
    notificationType: message.notificationType,
    source: message.source,
    sentAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
    recipientUserIds,
  });
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
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!PUBLIC_KEY || !PRIVATE_KEY) {
      throw new Error("VAPID keys are not configured on the server");
    }

    const subs = await ctx.runQuery(
      api.pushNotifications.getSubscriptions,
      args.userId ? { userId: args.userId } : { userId: undefined }
    );

    const { userId, ...message } = args;
    // History first, so a muted push stays visible in the app.
    const recipientUserIds = userId
      ? [userId]
      : subs.length > 0
        ? Array.from(new Set(subs.map((sub) => sub.userId as Id<"users">)))
        : undefined;
    await writeHistory(ctx, message, recipientUserIds);

    if (subs.length === 0 && !userId) {
      await ctx.runMutation(api.notificationAudit.logAttempt, {
        userId: undefined,
        notificationType: args.notificationType,
        source: args.source,
        title: args.title,
        body: args.body,
        success: false,
        error: "no_subscriptions",
        sentAt: Date.now(),
      });
      return null;
    }

    await pushToSubscriptions(ctx, subs, message, userId ? [userId] : undefined);
    return null;
  },
});

/**
 * Targeted delivery where each member gets their own text (assignment and
 * event change notices). Scheduled from the send mutation once the receipts
 * have committed, so it is best-effort: the Action Centre item is the copy
 * that's guaranteed. One history row per member.
 */
export const deliverToUsers = internalAction({
  args: {
    messages: v.array(
      v.object({
        userId: v.id("users"),
        title: v.string(),
        body: v.string(),
        url: v.string(),
      })
    ),
    notificationType: v.string(),
    source: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!PUBLIC_KEY || !PRIVATE_KEY) {
      console.warn("deliverToUsers: VAPID keys are not configured, skipping push");
      return null;
    }
    const subs: any[] = await ctx.runQuery(internal.pushNotifications.getSubscriptionsForUsers, {
      userIds: args.messages.map((m) => m.userId),
    });
    for (const { userId, ...rest } of args.messages) {
      const message = { ...rest, notificationType: args.notificationType, source: args.source };
      await writeHistory(ctx, message, [userId]);
      await pushToSubscriptions(
        ctx,
        subs.filter((sub) => sub.userId === userId),
        message,
        [userId]
      );
    }
    return null;
  },
});

// Self-service test send, for the user settings page. Unlike sendNotification
// (admin-only UI, can target any user or broadcast), this always sends to the
// caller's own device(s), optionally narrowed to one specific device - used
// to help a user troubleshoot "why isn't this device getting notifications."
export const sendTestNotificationToSelf = action({
  args: {
    subscriptionId: v.optional(v.id("pushSubscriptions")),
  },
  returns: v.object({
    sentCount: v.number(),
    failedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!PUBLIC_KEY || !PRIVATE_KEY) {
      throw new Error("VAPID keys are not configured on the server");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const allSubs = await ctx.runQuery(internal.pushNotifications.getMySubscriptionsRaw, {});
    const targetSubs = args.subscriptionId
      ? allSubs.filter((sub) => sub._id === args.subscriptionId)
      : allSubs;

    if (args.subscriptionId && targetSubs.length === 0) {
      throw new Error("Device not found");
    }

    const payload = JSON.stringify({
      title: "BRAVO test notification",
      body: "If you can see this, push notifications are working on this device.",
    });
    const now = Date.now();

    let sentCount = 0;
    let failedCount = 0;

    for (const sub of targetSubs) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        sentCount++;
        await ctx.runMutation(api.notificationAudit.logAttempt, {
          userId,
          subscriptionId: sub._id,
          endpoint: sub.subscription?.endpoint,
          notificationType: "test",
          source: "userSettings:selfTest",
          title: "BRAVO test notification",
          body: "If you can see this, push notifications are working on this device.",
          success: true,
          sentAt: now,
        });
      } catch (err: any) {
        failedCount++;

        if (err.statusCode === 410 || err.statusCode === 404) {
          await ctx.runMutation(api.pushNotifications.deleteSubscription, {
            id: sub._id,
          });
        }

        const errorMessage = typeof err?.message === "string" ? err.message : String(err);
        await ctx.runMutation(api.notificationAudit.logAttempt, {
          userId,
          subscriptionId: sub._id,
          endpoint: sub.subscription?.endpoint,
          notificationType: "test",
          source: "userSettings:selfTest",
          title: "BRAVO test notification",
          body: "If you can see this, push notifications are working on this device.",
          success: false,
          error: errorMessage,
          sentAt: now,
        });
      }
    }

    return { sentCount, failedCount };
  },
});
