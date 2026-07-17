"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { trackCronNotification } from "./posthogAnalytics";

// Action triggered by daily cron to reset statuses and send push notifications
export const nightlyReset = action({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const startTime = Date.now();
    
    // Check if notifications are enabled for this type
    const notificationsEnabled = await ctx.runQuery(api.notificationSettings.isNotificationEnabled, {
      notificationType: "nightlyReset"
    });

    const users = await ctx.runQuery(api.availability.getAllUsersStatus, {});

    let successCount = 0;
    let failureCount = 0;
    let totalRecipients = 0;

    for (const user of users) {
      if (user.currentStatus) {
        // Check if the user has a duration-based status that hasn't expired
        const hasActiveDuration = user.statusExpiresAt && user.statusExpiresAt > Date.now();
        
        if (!hasActiveDuration) {
          // Only clear status if no active duration
          await ctx.runMutation(api.availability.clearStatus, { userId: user._id });
          
          // Only send notification if enabled
          if (notificationsEnabled) {
            totalRecipients++;
            try {
              await ctx.runAction(api.pushNotificationAction.sendNotification, {
                title: "Daily Availability Reset",
                body: "Please update your availability status for today.",
                userId: user._id,
                url: "/availability", // Deep-link to availability page
                notificationType: "nightlyReset",
                source: "cron:nightlyReset",
              });
              successCount++;
            } catch  {
              failureCount++;
            }
          }
        }
      }
    }

    // Track cron execution in PostHog
    const duration = Date.now() - startTime;
    await trackCronNotification({
      cronName: "nightlyReset",
      notificationType: "nightlyReset",
      recipientCount: totalRecipients,
      successCount,
      failureCount,
      duration,
    });

    return successCount;
  },
});

// Action triggered by cron to send reminders to users who haven't set their status
export const morningReminder = action({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const startTime = Date.now();
    
    // Check if notifications are enabled for this type
    const notificationsEnabled = await ctx.runQuery(api.notificationSettings.isNotificationEnabled, {
      notificationType: "morningReminder"
    });

    // If notifications are disabled, track and return early
    if (!notificationsEnabled) {
      await trackCronNotification({
        cronName: "morningReminder",
        notificationType: "morningReminder",
        recipientCount: 0,
        successCount: 0,
        failureCount: 0,
        duration: Date.now() - startTime,
      });
      return 0;
    }

    // Get all users to check their status (raw status fields)
    const users = await ctx.runQuery(api.availability.getAllUsersStatus, {});
    
    let successCount = 0;
    let failureCount = 0;
    let totalRecipients = 0;

    for (const user of users) {
      // Treat expired statuses as unset so users with lapsed durations still get reminders
      const hasActiveStatus = !!user.currentStatus && (!user.statusExpiresAt || user.statusExpiresAt > Date.now());
      const needsReminder = !hasActiveStatus;
      
      if (needsReminder) {
        totalRecipients++;
        try {
          await ctx.runAction(api.pushNotificationAction.sendNotification, {
            title: "Availability Status Reminder",
            body: "Don't forget to set your availability status for the day",
            userId: user._id,
            url: "/availability", // Deep-link to availability page
            notificationType: "morningReminder",
            source: "cron:morningReminder",
          });
          successCount++;
        } catch (err) {
          // Log error but continue with other users
          console.error(`Failed to send reminder to user ${user._id}:`, err);
          failureCount++;
        }
      }
    }

    // Track cron execution in PostHog
    const duration = Date.now() - startTime;
    await trackCronNotification({
      cronName: "morningReminder",
      notificationType: "morningReminder",
      recipientCount: totalRecipients,
      successCount,
      failureCount,
      duration,
    });

    return successCount;
  },
});
