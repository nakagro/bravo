"use node";

import { action, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { trackCronNotification } from "./posthogAnalytics";

/**
 * Single funnel for all event pushes so future triggers (on-create broadcast
 * etc.) are one-line additions. userId undefined = broadcast to everyone.
 */
async function sendEventPush(
  ctx: ActionCtx,
  args: {
    userId?: Id<"users">;
    title: string;
    body: string;
    eventId: Id<"events">;
    notificationType: string;
    source: string;
  }
) {
  await ctx.runAction(api.pushNotificationAction.sendNotification, {
    title: args.title,
    body: args.body,
    userId: args.userId,
    url: `/events/${args.eventId}`,
    notificationType: args.notificationType,
    source: args.source,
  });
}

// Format "YYYY-MM-DD" as e.g. "Sat 13 Jun" without pulling in date-fns
function formatEventDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Format "HH:MM" as 12-hour time
function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Organiser-triggered broadcast to all members about an event, with an
 * optional custom message. Gated to eventsAdmin.
 */
export const notifyEventMembers = action({
  args: {
    eventId: v.id("events"),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in");
    }

    const hasAccess = await ctx.runQuery(api.modules.checkModuleAccess, {
      moduleId: "eventsAdmin",
    });
    if (!hasAccess) {
      throw new Error("You do not have access to notify members about events");
    }

    const event = await ctx.runQuery(api.events.getEvent, { eventId: args.eventId });
    if (!event) {
      throw new Error("Event not found");
    }

    let body = args.message?.trim();
    if (!body) {
      const parts = [formatEventDate(event.startDate)];
      if (!event.isAllDay && event.startTime) {
        parts.push(formatTime(event.startTime));
      }
      if (event.location) {
        parts.push(event.location);
      }
      body =
        event.status === "cancelled"
          ? `Cancelled: ${parts.join(" · ")}`
          : `${parts.join(" · ")} — tap to RSVP`;
    }

    await sendEventPush(ctx, {
      userId: undefined, // broadcast
      title: event.title,
      body,
      eventId: args.eventId,
      notificationType: "eventNotification",
      source: "events:manual",
    });

    await ctx.runMutation(internal.events.recordNotificationSent, {
      eventId: args.eventId,
      userId,
      notes: args.message?.trim() || "Broadcast to all members",
    });

    return null;
  },
});

/**
 * Cron entry: the evening before each event, remind attending/maybe members
 * and nudge non-responders. Members who said "not attending" get nothing.
 * Safe to re-run — reminderSentAt gives at-most-once delivery per event.
 */
export const sendEventReminders = action({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const startTime = Date.now();

    // Kill switch (admin-controlled in Notification Settings)
    const notificationsEnabled = await ctx.runQuery(
      api.notificationSettings.isNotificationEnabled,
      { notificationType: "eventReminder" }
    );

    if (!notificationsEnabled) {
      await trackCronNotification({
        cronName: "eventReminder",
        notificationType: "eventReminder",
        recipientCount: 0,
        successCount: 0,
        failureCount: 0,
        duration: Date.now() - startTime,
      });
      return 0;
    }

    // AEST tomorrow: now + 10h (UTC→AEST) + 24h (tomorrow), same hardcoded
    // UTC+10 assumption as crons.ts (drifts 1h during AEDT — accepted)
    const targetDate = new Date(Date.now() + 34 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { events, allUserIds } = await ctx.runQuery(internal.events.getReminderTargets, {
      targetDate,
    });

    let successCount = 0;
    let failureCount = 0;
    let totalRecipients = 0;

    for (const event of events) {
      const rsvpByUser = new Map(event.rsvps.map((rsvp) => [rsvp.userId, rsvp.status]));
      const timeSuffix =
        !event.isAllDay && event.startTime ? ` at ${formatTime(event.startTime)}` : "";
      const locationSuffix = event.location ? ` (${event.location})` : "";

      for (const userId of allUserIds) {
        const status = rsvpByUser.get(userId);
        if (status === "notAttending") continue;

        const body =
          status === "attending" || status === "maybe"
            ? `Reminder: ${event.title} is tomorrow${timeSuffix}${locationSuffix}.`
            : `${event.title} is tomorrow${timeSuffix} — let the brigade know if you can make it.`;

        totalRecipients++;
        try {
          await sendEventPush(ctx, {
            userId,
            title: "Event Reminder",
            body,
            eventId: event._id,
            notificationType: "eventReminder",
            source: "cron:eventReminder",
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to send event reminder to user ${userId}:`, err);
          failureCount++;
        }
      }

      await ctx.runMutation(internal.events.markReminderSent, { eventId: event._id });
    }

    await trackCronNotification({
      cronName: "eventReminder",
      notificationType: "eventReminder",
      recipientCount: totalRecipients,
      successCount,
      failureCount,
      duration: Date.now() - startTime,
    });

    return successCount;
  },
});
