import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { eventManagerId } from "../../events";
import { seatLines } from "../crewSeats";
import { brigadeDateStr } from "../dates";
import { MAX_APPLIANCES_PER_EVENT } from "../eventCrews";
import { WHOLE_EVENT_LINE, formatDateRange, formatDay, formatTime12 } from "../notificationTemplates";
import type { AssignmentSource } from "./types";

// Event assignment notices: the event's appliance crews plus its roster
// (eventSlotAllocations). Fills {eventTitle}, {date}, {time}, {location} and,
// per member, {assignment}. With the default template a crewed member gets:
//   You're rostered: Open day
//   Driver on Tanker 1
//   Shift: Morning (09:00–11:00)
//   Sat 14 Dec · Main Station

export { WHOLE_EVENT_LINE };

export function eventIsOver(event: Doc<"events">): boolean {
  return (event.endDate ?? event.startDate) < brigadeDateStr();
}

/** Scope-wide values, shared with event change notices. */
export function eventValues(event: Doc<"events">): Record<string, string> {
  return {
    eventTitle: event.title,
    date: formatDateRange(event.startDate, event.endDate),
    time: !event.isAllDay && event.startTime ? formatTime12(event.startTime) : "",
    location: event.location || event.address || "",
  };
}

export function slotLine(slot: Doc<"eventSlots">): string {
  const times =
    slot.startTime && slot.endTime
      ? `${slot.startTime}–${slot.endTime}`
      : slot.startTime ?? "";
  const when = [slot.date ? formatDay(slot.date) : "", times].filter(Boolean).join(" ");
  return when ? `${slot.label} (${when})` : slot.label;
}

async function loadEvent(ctx: QueryCtx, scopeId: string) {
  const id = ctx.db.normalizeId("events", scopeId);
  return id ? await ctx.db.get(id) : null;
}

export const eventAssignmentSource: AssignmentSource = {
  async senderId(ctx, scopeId) {
    const event = await loadEvent(ctx, scopeId);
    return event ? await eventManagerId(ctx, event) : null;
  },

  async load(ctx, scopeId) {
    const event = await loadEvent(ctx, scopeId);
    if (!event || event.status === "cancelled" || eventIsOver(event)) return null;

    const [crews, allocations, slots] = await Promise.all([
      ctx.db
        .query("eventCrews")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .take(MAX_APPLIANCES_PER_EVENT * 2),
      ctx.db
        .query("eventSlotAllocations")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect(),
      ctx.db
        .query("eventSlots")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect(),
    ]);
    const slotById = new Map(slots.map((s) => [s._id, s]));

    // Seats first, then shifts in slot order, so the joined text reads naturally.
    const held = new Map<Id<"users">, { seats: string[]; shifts: { order: number; line: string }[]; whole: boolean }>();
    const entry = (userId: Id<"users">) => {
      let e = held.get(userId);
      if (!e) held.set(userId, (e = { seats: [], shifts: [], whole: false }));
      return e;
    };
    const externalNames: string[] = [];
    for (const crew of [...crews].sort((a, b) => a._creationTime - b._creationTime)) {
      const { members, external } = seatLines(crew);
      for (const m of members) entry(m.userId).seats.push(m.line);
      externalNames.push(...external);
    }
    for (const a of allocations) {
      const slot = a.slotId ? slotById.get(a.slotId) : undefined;
      if (a.slotId && !slot) continue; // slot deleted mid-cascade
      if (slot) entry(a.userId).shifts.push({ order: slot.order, line: slotLine(slot) });
      else entry(a.userId).whole = true;
    }

    const assignments = [...held].map(([userId, e]) => {
      const shifts = e.shifts.sort((a, b) => a.order - b.order).map((s) => s.line);
      const lines = [...e.seats, ...(e.whole ? [WHOLE_EVENT_LINE] : []), ...shifts];
      // A shift gives its own times, so the event start time would mislead.
      const onlyShifts = e.seats.length === 0 && !e.whole;
      return { userId, lines, values: onlyShifts ? { time: "" } : undefined };
    });

    return {
      scopeKey: `event:${event._id}`,
      templatePrefix: "event",
      moduleId: "events",
      notificationType: "eventAssignment",
      url: `/events/${event._id}`,
      values: eventValues(event),
      assignments,
      externalNames,
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
