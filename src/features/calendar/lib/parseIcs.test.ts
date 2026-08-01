import { describe, expect, it } from "vitest";
import { parseIcs, selectUpcoming, type CalendarEvent } from "./parseIcs";

const wrap = (...components: string[]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//test//EN",
    ...components,
    "END:VCALENDAR",
  ].join("\r\n");

const AUG_START = new Date(Date.UTC(2026, 7, 1));
const AUG_END = new Date(Date.UTC(2026, 7, 31, 23, 59, 59));

describe("parseIcs", () => {
  it("flags an event with no DTEND as open-ended", () => {
    const ics = wrap(
      "BEGIN:VEVENT",
      "UID:open-1",
      "DTSTART:20260810T090000Z",
      "SUMMARY:Working bee",
      "END:VEVENT",
    );

    const [event] = parseIcs(ics, AUG_START, AUG_END);
    expect(event.endUnknown).toBe(true);
    expect(event.end.getTime()).toBe(event.start.getTime());
  });

  it("parses a single timed event with its fields", () => {
    const ics = wrap(
      "BEGIN:VEVENT",
      "UID:single-1",
      "DTSTART:20260810T090000Z",
      "DTEND:20260810T103000Z",
      "SUMMARY:Truck check",
      "LOCATION:Station",
      "DESCRIPTION:Monthly appliance check",
      "END:VEVENT",
    );

    const events = parseIcs(ics, AUG_START, AUG_END);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: "single-1",
      summary: "Truck check",
      location: "Station",
      description: "Monthly appliance check",
      allDay: false,
      recurring: false,
    });
    expect(events[0].start.toISOString()).toBe("2026-08-10T09:00:00.000Z");
    expect(events[0].end.toISOString()).toBe("2026-08-10T10:30:00.000Z");
  });

  it("excludes events outside the requested range", () => {
    const ics = wrap(
      "BEGIN:VEVENT",
      "UID:before-1",
      "DTSTART:20260710T090000Z",
      "DTEND:20260710T100000Z",
      "SUMMARY:July meeting",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:after-1",
      "DTSTART:20260910T090000Z",
      "DTEND:20260910T100000Z",
      "SUMMARY:September meeting",
      "END:VEVENT",
    );

    expect(parseIcs(ics, AUG_START, AUG_END)).toHaveLength(0);
  });

  it("marks all-day events and leaves optional fields undefined", () => {
    const ics = wrap(
      "BEGIN:VEVENT",
      "UID:allday-1",
      "DTSTART;VALUE=DATE:20260815",
      "DTEND;VALUE=DATE:20260816",
      "SUMMARY:Open day",
      "END:VEVENT",
    );

    const events = parseIcs(
      ics,
      new Date(2026, 6, 1),
      new Date(2026, 8, 1),
    );

    expect(events).toHaveLength(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].location).toBeUndefined();
    expect(events[0].description).toBeUndefined();
  });

  it("expands an unbounded weekly RRULE only within the range", () => {
    const ics = wrap(
      "BEGIN:VEVENT",
      "UID:weekly-1",
      "DTSTART:20200106T090000Z",
      "DTEND:20200106T100000Z",
      "SUMMARY:Training night",
      "RRULE:FREQ=WEEKLY",
      "END:VEVENT",
    );

    const events = parseIcs(ics, AUG_START, AUG_END);

    // Mondays in August 2026: 3, 10, 17, 24, 31
    expect(events).toHaveLength(5);
    expect(events.every((e) => e.summary === "Training night")).toBe(true);
    expect(events.every((e) => e.recurring)).toBe(true);
    expect(events[0].start.getUTCDate()).toBe(3);
    expect(events[4].start.getUTCDate()).toBe(31);
    // Expanded occurrences need distinct uids for React keys
    expect(new Set(events.map((e) => e.uid)).size).toBe(5);
  });

  it("honours EXDATE exclusions on recurring events", () => {
    const ics = wrap(
      "BEGIN:VEVENT",
      "UID:weekly-2",
      "DTSTART:20260803T090000Z",
      "DTEND:20260803T100000Z",
      "SUMMARY:Training night",
      "RRULE:FREQ=WEEKLY;COUNT=5",
      "EXDATE:20260817T090000Z",
      "END:VEVENT",
    );

    const events = parseIcs(ics, AUG_START, AUG_END);

    expect(events).toHaveLength(4);
    expect(events.some((e) => e.start.getUTCDate() === 17)).toBe(false);
  });

  it("returns events sorted by start time", () => {
    const ics = wrap(
      "BEGIN:VEVENT",
      "UID:late",
      "DTSTART:20260820T090000Z",
      "DTEND:20260820T100000Z",
      "SUMMARY:Late",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:early",
      "DTSTART:20260805T090000Z",
      "DTEND:20260805T100000Z",
      "SUMMARY:Early",
      "END:VEVENT",
    );

    const events = parseIcs(ics, AUG_START, AUG_END);

    expect(events.map((e) => e.summary)).toEqual(["Early", "Late"]);
  });

  it("throws a friendly error on malformed input", () => {
    expect(() => parseIcs("not an ics payload", AUG_START, AUG_END)).toThrow(
      "Failed to parse calendar data",
    );
  });
});

describe("selectUpcoming", () => {
  const make = (uid: string, start: string): CalendarEvent => ({
    uid,
    summary: uid,
    start: new Date(start),
    end: new Date(start),
    allDay: false,
    endUnknown: false,
    recurring: false,
  });

  it("drops past events and caps the count", () => {
    const now = new Date("2026-08-10T00:00:00Z");
    const events = [
      make("past", "2026-08-01T09:00:00Z"),
      make("a", "2026-08-11T09:00:00Z"),
      make("b", "2026-08-12T09:00:00Z"),
      make("c", "2026-08-13T09:00:00Z"),
    ];

    expect(selectUpcoming(events, 2, now).map((e) => e.uid)).toEqual([
      "a",
      "b",
    ]);
  });
});
