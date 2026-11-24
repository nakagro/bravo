import type { QueryCtx } from "../../_generated/server";
import { eventManagerId, isPrivateEvent } from "../../events";
import { eventIsOver, eventValues } from "./eventSource";
import type { AssignmentSource } from "./types";

// Private event invite notices: "You're invited: BMT Planning", eagerly waiting
// for the organiser to review and send after creating a private event or adding
// new invitees. Uses its own receipt scope ("eventInvite:<id>") so invite
// receipts stay independent of crew/roster receipts ("event:<id>"), while
// logging into the same event NotificationLog ("event:<id>").

async function loadEvent(ctx: QueryCtx, scopeId: string) {
  const id = ctx.db.normalizeId("events", scopeId);
  return id ? await ctx.db.get(id) : null;
}

export const eventInviteSource: AssignmentSource = {
  async senderId(ctx, scopeId) {
    const event = await loadEvent(ctx, scopeId);
    return event ? await eventManagerId(ctx, event) : null;
  },

  async load(ctx, scopeId) {
    const event = await loadEvent(ctx, scopeId);
    if (!event || !isPrivateEvent(event) || event.status === "cancelled" || eventIsOver(event)) {
      return null;
    }

    // Everyone invited (including team leaders), excluding the organiser who
    // created/owns the event.
    const inviteeIds = [
      ...new Set([...(event.invitedUserIds ?? []), ...(event.teamLeaderIds ?? [])]),
    ].filter((id) => id !== event.createdBy);

    return {
      scopeKey: `eventInvite:${event._id}`,
      logScopeKey: `event:${event._id}`,
      logKind: "invite",
      skipRemoved: true,
      templatePrefix: "eventInvite",
      moduleId: "events",
      notificationType: "eventNotification",
      url: `/events/${event._id}`,
      values: eventValues(event),
      assignments: inviteeIds.map((userId) => ({ userId, lines: ["Invited"] })),
      externalNames: [],
    };
  },

  async recordSend(ctx, scopeId, senderId, summary) {
    const eventId = ctx.db.normalizeId("events", scopeId);
    if (!eventId) return;
    await ctx.db.insert("eventHistory", {
      eventId,
      timestamp: Date.now(),
      userId: senderId,
      changeType: "notification_sent",
      field: "notification",
      oldValue: null,
      newValue: "sent",
      notes: summary,
    });
  },
};
