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
                notificationType: "nightlyReset",
                source: "cron:nightlyReset",
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

    // Get all users to check their status (raw status fields)
    const users = await ctx.runQuery(api.availability.getAllUsersStatus, {});
    
    let notificationCount = 0;

    for (const user of users) {
      // Treat expired statuses as unset so users with lapsed durations still get reminders
      const hasActiveStatus = !!user.currentStatus && (!user.statusExpiresAt || user.statusExpiresAt > Date.now());
      const needsReminder = !hasActiveStatus;
      
      if (needsReminder) {
        try {
          await ctx.runAction(api.pushNotificationAction.sendNotification, {
            title: "Availability Status Reminder",
            body: "Don't forget to set your availability status for the day",
            userId: user._id,
            url: "/availability", // Deep-link to availability page
            notificationType: "morningReminder",
            source: "cron:morningReminder",
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
