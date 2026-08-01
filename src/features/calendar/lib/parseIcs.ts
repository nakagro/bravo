import ICAL from "ical.js";

export interface CalendarEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  allDay: boolean;
  /**
   * True when the VEVENT carries no DTEND/DURATION — the finish time isn't
   * known. `end` then equals `start`; treat it as open-ended when displaying.
   */
  endUnknown: boolean;
  /** True for expanded RRULE occurrences — read-only in BRAVO (v1) */
  recurring: boolean;
}

/**
 * Parse an iCalendar payload into flat event occurrences.
 *
 * Recurring events are expanded within [rangeStart, rangeEnd]. The range must
 * stay bounded: an unbounded RRULE would otherwise keep the iterator running
 * forever.
 */
export function parseIcs(
  icsData: string,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  try {
    const jcalData = ICAL.parse(icsData);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents("vevent");

    const events: CalendarEvent[] = [];

    // ical.js synthesises an endDate when neither DTEND nor DURATION is
    // present, so ask the component itself whether a finish was ever given.
    const hasEnd = (vevent: ICAL.Component) =>
      vevent.hasProperty("dtend") || vevent.hasProperty("duration");

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      if (event.isRecurring()) {
        const iterator = event.iterator();
        let next;

        while ((next = iterator.next())) {
          const occurrence = event.getOccurrenceDetails(next);
          const startDate = occurrence.startDate.toJSDate();

          if (startDate > rangeEnd) break;

          if (startDate >= rangeStart) {
            events.push({
              uid: `${event.uid}-${startDate.getTime()}`,
              summary: event.summary || "Untitled Event",
              start: startDate,
              end: occurrence.endDate.toJSDate(),
              description: event.description ?? undefined,
              location: event.location ?? undefined,
              allDay: event.startDate.isDate,
              endUnknown: !hasEnd(vevent),
              recurring: true,
            });
          }
        }
      } else {
        const startDate = event.startDate.toJSDate();

        if (startDate >= rangeStart && startDate <= rangeEnd) {
          events.push({
            uid: event.uid,
            summary: event.summary || "Untitled Event",
            start: startDate,
            end: event.endDate.toJSDate(),
            description: event.description ?? undefined,
            location: event.location ?? undefined,
            allDay: event.startDate.isDate,
            endUnknown: !hasEnd(vevent),
            recurring: false,
          });
        }
      }
    }

    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
  } catch (err) {
    console.error("Error parsing ICS data:", err);
    throw new Error("Failed to parse calendar data");
  }
}

/** Next events from `now` on, for the compact dashboard widget. */
export function selectUpcoming(
  events: CalendarEvent[],
  maxEvents: number,
  now: Date = new Date(),
): CalendarEvent[] {
  return events.filter((event) => event.start >= now).slice(0, maxEvents);
}
