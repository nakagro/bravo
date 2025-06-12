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

    const payload = JSON.stringify({ title: args.title, body: args.body });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (err: any) {
        // Clean up stale subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await ctx.runMutation(api.pushNotifications.deleteSubscription, {
            id: sub._id,
          });
        }
      }
    }
  },
});
