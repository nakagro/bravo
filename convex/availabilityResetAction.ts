"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Node runtime action triggered by daily cron to reset statuses and send push notifications
export const nightlyReset = action({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const users = await ctx.runQuery(api.availability.getAllUsersStatus, {});

    let count = 0;

    for (const user of users) {
      if (user.currentStatus) {
        // Check if the user has a duration-based status that hasn't expired
        const hasActiveDuration = user.statusExpiresAt && user.statusExpiresAt > Date.now();
        
        if (!hasActiveDuration) {
          // Only clear status if no active duration
          await ctx.runMutation(api.availability.clearStatus, { userId: user._id });
          try {
            await ctx.runAction(api.pushNotificationAction.sendNotification, {
              title: "Daily Availability Reset",
              body: "Please update your availability status for today.",
              userId: user._id,
            });
            count++;
          } catch (err) {
            // ignore
          }
        }
      }
    }

    return count;
  },
});
