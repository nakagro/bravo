import { ActionProvider } from "./types";

function aestDateOffset(days: number): string {
  return new Date(Date.now() + 10 * 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export const eventRsvpProvider: ActionProvider = async (ctx, p) => {
  if (!p.hasModuleAccess("events")) return [];

  const { userId } = p;
  const today = aestDateOffset(0);
  const thirtyDaysFromNow = aestDateOffset(30);
  const twoDaysFromNow = aestDateOffset(2);

  // All active future events — no upper bound on startDate so events with a
  // future respondBy date always surface regardless of how far away they are.
  const futureEvents = await ctx.db
    .query("events")
    .withIndex("by_status_startDate", (q) =>
      q.eq("status", "active").gte("startDate", today)
    )
    .take(100);

  // Include an event when:
  //   - it has a respondBy date that hasn't passed yet, OR
  //   - it has no respondBy date and starts within 30 days
  const relevantEvents = futureEvents.filter((event) =>
    event.respondBy ? event.respondBy >= today : event.startDate <= thirtyDaysFromNow
  );

  const actions = [];

  for (const event of relevantEvents) {
    const existing = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", event._id).eq("userId", userId)
      )
      .first();

    if (existing) continue;

    // High priority if the event itself or the respondBy deadline is within 2 days
    const isUrgent =
      event.startDate <= twoDaysFromNow ||
      (!!event.respondBy && event.respondBy <= twoDaysFromNow);

    const desc = event.respondBy
      ? `RSVP by ${event.respondBy} · Event on ${event.startDate}`
      : `Event on ${event.startDate}${event.startTime ? ` at ${event.startTime}` : ""}`;

    actions.push({
      id: `events:rsvp:${event._id}`,
      moduleId: "events",
      kind: "rsvp",
      title: `RSVP: ${event.title}`,
      description: desc,
      url: `/events/${event._id}`,
      actionLabel: "RSVP",
      priority: isUrgent ? ("high" as const) : ("medium" as const),
      createdAt: event.createdAt,
      meta: { eventId: event._id, startDate: event.startDate },
    });
  }

  return actions;
};
