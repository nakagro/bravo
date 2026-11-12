"use node";

import { action, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

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
 * optional custom message. Gated to whoever runs the event - eventsAdmin, the
 * organiser, or a named team leader (`canManage` carries that rule).
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

    const event = await ctx.runQuery(api.events.getEvent, { eventId: args.eventId });
    if (!event) {
      throw new Error("Event not found");
    }
    if (!event.canManage) {
      throw new Error("You do not have access to notify members about events");
    }

    let body = args.message?.trim();
    if (!body) {
      const parts = [formatEventDate(event.startDate)];
      if (!event.isAllDay && event.startTime) {
        parts.push(formatTime(event.startTime));
      }
      // One of the two may be set on its own; the venue name reads better first
      if (event.location || event.address) {
        parts.push(event.location || (event.address as string));
      }
      body =
        event.status === "cancelled"
          ? `Cancelled: ${parts.join(" · ")}`
          : `${parts.join(" · ")} - tap to RSVP`;
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
      title: event.title,
      message: args.message?.trim() || undefined,
    });

    return null;
  },
});
