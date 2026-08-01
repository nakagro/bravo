import { describe, expect, it } from "vitest";
import {
  coveredDays,
  fromBookings,
  fromBrigadeEvents,
  fromIcsEvents,
  groupItemsByDay,
  type BookingInput,
  type BrigadeEventInput,
  type CalendarItem,
} from "./calendarItems";
import type { CalendarEvent } from "./parseIcs";

function icsEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    uid: "abc",
    summary: "Training night",
    start: new Date(2026, 6, 15, 18, 0),
    end: new Date(2026, 6, 15, 19, 0),
    allDay: false,
    endUnknown: false,
    recurring: false,
    ...overrides,
  };
}

function brigadeEvent(overrides: Partial<BrigadeEventInput> = {}): BrigadeEventInput {
  return {
    _id: "ev1",
    title: "Sausage sizzle",
    status: "active",
    startDate: "2026-07-18",
    isAllDay: true,
    counts: { attending: 3, maybe: 1, notAttending: 0 },
    ...overrides,
  };
}

function booking(overrides: Partial<BookingInput> = {}): BookingInput {
  return {
    _id: "bk1",
    status: "approved",
    startDate: "2026-07-20",
    isAllDay: true,
    resource: { name: "Tanker 1" },
    ...overrides,
  };
}

describe("open-ended items", () => {
  it("marks a timed brigade event with no end time as end-unknown", () => {
    const [item] = fromBrigadeEvents([
      brigadeEvent({ isAllDay: false, startTime: "09:00", endTime: undefined }),
    ]);
    expect(item.endUnknown).toBe(true);
    // A nominal end still exists so the item lands on its day
    expect(item.end.getTime()).toBeGreaterThan(item.start.getTime());
  });

  it("leaves an event with an end time alone", () => {
    const [item] = fromBrigadeEvents([
      brigadeEvent({ isAllDay: false, startTime: "09:00", endTime: "11:00" }),
    ]);
    expect(item.endUnknown).toBe(false);
  });

  it("carries the open-ended flag through from ICS", () => {
    const [item] = fromIcsEvents([
      icsEvent({ endUnknown: true, end: new Date(2026, 6, 15, 18, 0) }),
    ]);
    expect(item.endUnknown).toBe(true);
    expect(coveredDays(item)).toEqual(["2026-07-15"]);
  });
});

describe("fromBrigadeEvents", () => {
  it("skips cancelled events", () => {
    const items = fromBrigadeEvents([brigadeEvent({ status: "cancelled" })]);
    expect(items).toHaveLength(0);
  });

  it("normalizes an inclusive end date to an exclusive end", () => {
    const [item] = fromBrigadeEvents([
      brigadeEvent({ startDate: "2026-07-18", endDate: "2026-07-19" }),
    ]);
    expect(item.allDay).toBe(true);
    expect(coveredDays(item)).toEqual(["2026-07-18", "2026-07-19"]);
  });

  it("builds local timed dates from date + time strings", () => {
    const [item] = fromBrigadeEvents([
      brigadeEvent({ isAllDay: false, startTime: "18:30", endTime: "20:00" }),
    ]);
    expect(item.allDay).toBe(false);
    expect(item.start).toEqual(new Date(2026, 6, 18, 18, 30));
    expect(item.end).toEqual(new Date(2026, 6, 18, 20, 0));
  });

  it("falls back to all-day when a timed event has no start time", () => {
    const [item] = fromBrigadeEvents([brigadeEvent({ isAllDay: false })]);
    expect(item.allDay).toBe(true);
  });
});

describe("fromBookings", () => {
  it("keeps only pending and approved bookings", () => {
    const items = fromBookings([
      booking({ _id: "a", status: "approved" }),
      booking({ _id: "b", status: "pending" }),
      booking({ _id: "c", status: "rejected" }),
      booking({ _id: "d", status: "cancelled" }),
    ]);
    expect(items.map((item) => item.bookingStatus)).toEqual(["approved", "pending"]);
  });

  it("titles blocked bookings as unavailable without a requester", () => {
    const [item] = fromBookings([
      booking({ isBlocked: true, requestedByUser: { name: "Ignored" } }),
    ]);
    expect(item.title).toBe("Tanker 1 unavailable");
    expect(item.bookedBy).toBeUndefined();
  });

  it("prefers first/last name over the login name", () => {
    const [item] = fromBookings([
      booking({ requestedByUser: { firstName: "Alex", lastName: "Nguyen", name: "alexn" } }),
    ]);
    expect(item.bookedBy).toBe("Alex Nguyen");
  });
});

describe("coveredDays", () => {
  it("covers every day of a multi-day all-day ICS event (exclusive end)", () => {
    const [item] = fromIcsEvents([
      icsEvent({
        allDay: true,
        start: new Date(2026, 6, 10),
        end: new Date(2026, 6, 13), // exclusive → covers 10th–12th
      }),
    ]);
    expect(coveredDays(item)).toEqual(["2026-07-10", "2026-07-11", "2026-07-12"]);
  });

  it("does not spill a timed event ending at midnight onto the next day", () => {
    const [item] = fromIcsEvents([
      icsEvent({ start: new Date(2026, 6, 15, 20, 0), end: new Date(2026, 6, 16, 0, 0) }),
    ]);
    expect(coveredDays(item)).toEqual(["2026-07-15"]);
  });

  it("covers both days of a timed event crossing midnight", () => {
    const [item] = fromIcsEvents([
      icsEvent({ start: new Date(2026, 6, 15, 22, 0), end: new Date(2026, 6, 16, 2, 0) }),
    ]);
    expect(coveredDays(item)).toEqual(["2026-07-15", "2026-07-16"]);
  });
});

describe("groupItemsByDay", () => {
  it("lists a multi-day item on every covered day", () => {
    const items = fromBrigadeEvents([
      brigadeEvent({ startDate: "2026-07-18", endDate: "2026-07-20" }),
    ]);
    const byDay = groupItemsByDay(items);
    expect(byDay.get("2026-07-18")).toHaveLength(1);
    expect(byDay.get("2026-07-19")).toHaveLength(1);
    expect(byDay.get("2026-07-20")).toHaveLength(1);
    expect(byDay.get("2026-07-21")).toBeUndefined();
  });

  it("sorts all-day items first, then by start time", () => {
    const timedLate = fromIcsEvents([
      icsEvent({
        uid: "late",
        summary: "Late",
        start: new Date(2026, 6, 15, 19, 0),
        end: new Date(2026, 6, 15, 20, 0),
      }),
    ]);
    const timedEarly = fromIcsEvents([
      icsEvent({
        uid: "early",
        summary: "Early",
        start: new Date(2026, 6, 15, 9, 0),
        end: new Date(2026, 6, 15, 10, 0),
      }),
    ]);
    const allDay = fromBrigadeEvents([brigadeEvent({ startDate: "2026-07-15" })]);
    const byDay = groupItemsByDay([...timedLate, ...timedEarly, ...allDay]);
    const titles = (byDay.get("2026-07-15") ?? []).map((item: CalendarItem) => item.title);
    expect(titles).toEqual(["Sausage sizzle", "Early", "Late"]);
  });
});
