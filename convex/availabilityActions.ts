"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Action triggered by daily cron to reset statuses and send push notifications
export const nightlyReset = action({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    // Check if notifications are enabled for this type
    const notificationsEnabled = await ctx.runQuery(api.notificationSettings.isNotificationEnabled, {
      notificationType: "nightlyReset"
    });

    const users = await ctx.runQuery(api.availability.getAllUsersStatus, {});

    let count = 0;

    for (const user of users) {
      if (user.currentStatus) {
        // Check if the user has a duration-based status that hasn't expired
        const hasActiveDuration = user.statusExpiresAt && user.statusExpiresAt > Date.now();
        
        if (!hasActiveDuration) {
          // Only clear status if no active duration
          await ctx.runMutation(api.availability.clearStatus, { userId: user._id });
          
          // Only send notification if enabled
          if (notificationsEnabled) {
            try {
              await ctx.runAction(api.pushNotificationAction.sendNotification, {
                title: "Daily Availability Reset",
                body: "Please update your availability status for today.",
                userId: user._id,
                url: "/availability", // Deep-link to availability page
              });
              count++;
            } catch (err) {
              // ignore
            }
          }
        }
      }
    }

    return count;
  },
});

// Action triggered by cron to send reminders to users who haven't set their status
export const morningReminder = action({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    // Check if notifications are enabled for this type
    const notificationsEnabled = await ctx.runQuery(api.notificationSettings.isNotificationEnabled, {
      notificationType: "morningReminder"
    });

    // If notifications are disabled, return early
    if (!notificationsEnabled) {
      return 0;
    }

    // Get all users to check their status
    const users = await ctx.runQuery(api.availability.getAllUsersStatus, {});
    
    let notificationCount = 0;

    for (const user of users) {
      // Since daily reset at 4am clears currentStatus for users without active durations,
      // we can simply check if the user has a currentStatus or not
      const needsReminder = !user.currentStatus;
      
      if (needsReminder) {
        try {
          await ctx.runAction(api.pushNotificationAction.sendNotification, {
            title: "Availability Status Reminder",
            body: "Don't forget to set your availability status for the day",
            userId: user._id,
            url: "/availability", // Deep-link to availability page
          });
          notificationCount++;
        } catch (err) {
          // Log error but continue with other users
          console.error(`Failed to send reminder to user ${user._id}:`, err);
        }
      }
    }

    return notificationCount;
  },
});
