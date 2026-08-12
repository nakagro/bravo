import { addDays, eachDayOfInterval, format, parseISO, startOfDay } from "date-fns";
import { eventTypeColors, defaultEventTypeColor } from "../../events/types";
import type { CalendarEvent } from "./parseIcs";

/**
 * A single occurrence shown on the calendar, unified across the three
 * sources: the CalDAV brigade calendar (ICS), the Events module, and the
 * Bookings module. All-day items use an *exclusive* `end` (the ICS
 * convention); module data with inclusive end dates is normalized here.
 */
export type CalendarItemSource = "caldav" | "event" | "booking";

export interface CalendarItem {
  /** Unique across all sources, e.g. "event:<id>" */
  key: string;
  source: CalendarItemSource;
  title: string;
  start: Date;
  /** Exclusive for all-day items */
  end: Date;
  /**
   * True when no finish time was recorded. `end` still holds a nominal value
   * (a one-hour block) so layout and day-coverage keep working, but the UI
   * shows the event as open-ended rather than inventing a finish.
   */
  endUnknown?: boolean;
  allDay: boolean;
  location?: string;
  description?: string;
  /** caldav only - the raw ICS occurrence (edit/delete needs it) */
  ics?: CalendarEvent;
  /** event only - deep link target /events/:id */
  eventId?: string;
  /** event only - eventTypes colour key (e.g. "blue") */
  eventTypeColor?: string;
  eventTypeName?: string;
  eventCounts?: { attending: number; maybe: number; notAttending: number };
  /** booking only */
  bookingStatus?: "pending" | "approved";
  resourceName?: string;
  bookedBy?: string;
  bookingBlocked?: boolean;
  /** booking only - deep link target /bookings?tab=schedule&date=… */
  bookingDate?: string;
}

/** Structural subset of api.events.getUpcomingEvents results. */
export interface BrigadeEventInput {
  _id: string;
  title: string;
  description?: string;
  location?: string;
  status: "active" | "cancelled";
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  eventType?: string;
  eventTypeInfo?: { name: string; color: string } | null;
  counts: { attending: number; maybe: number; notAttending: number };
}

/** Structural subset of api.bookings.getBookingsForDateRange results. */
export interface BookingInput {
  _id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  isBlocked?: boolean;
  notes?: string;
  resource?: { name: string };
  requestedByUser?: { firstName?: string; lastName?: string; name?: string };
}

const DEFAULT_TIMED_DURATION_MS = 60 * 60 * 1000;

/**
 * Resolve start/end Dates from the shared module shape (YYYY-MM-DD dates,
 * optional HH:MM times, inclusive end date). Falls back to all-day when a
 * "timed" record is missing its start time.
 */
function resolveWhen(record: {
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
}): { start: Date; end: Date; allDay: boolean; endUnknown: boolean } {
  const lastDate =
    record.endDate && record.endDate >= record.startDate ? record.endDate : record.startDate;

  if (record.isAllDay || !record.startTime) {
    return {
      start: parseISO(record.startDate),
      // Inclusive last day → exclusive end
      end: addDays(parseISO(lastDate), 1),
      allDay: true,
      endUnknown: false,
    };
  }

  const start = new Date(`${record.startDate}T${record.startTime}`);
  const end = record.endTime
    ? new Date(`${lastDate}T${record.endTime}`)
    : new Date(start.getTime() + DEFAULT_TIMED_DURATION_MS);
  return {
    start,
    end: end > start ? end : new Date(start.getTime() + DEFAULT_TIMED_DURATION_MS),
    allDay: false,
    // A timed record without an end time runs until whenever it's done
    endUnknown: !record.endTime,
  };
}

export function fromIcsEvents(events: CalendarEvent[]): CalendarItem[] {
  return events.map((event) => ({
    key: `caldav:${event.uid}`,
    source: "caldav" as const,
    title: event.summary,
    start: event.start,
    end: event.endUnknown
      ? new Date(event.start.getTime() + DEFAULT_TIMED_DURATION_MS)
      : event.end,
    endUnknown: event.endUnknown,
    allDay: event.allDay,
    location: event.location,
    description: event.description,
    ics: event,
  }));
}

export function fromBrigadeEvents(events: BrigadeEventInput[]): CalendarItem[] {
  return events
    .filter((event) => event.status === "active")
    .map((event) => ({
      key: `event:${event._id}`,
      source: "event" as const,
      title: event.title,
      ...resolveWhen(event),
      location: event.location,
      description: event.description,
      eventId: event._id,
      eventTypeColor: event.eventTypeInfo?.color,
      eventTypeName: event.eventTypeInfo?.name ?? event.eventType,
      eventCounts: event.counts,
    }));
}

function bookedByName(booking: BookingInput): string | undefined {
  if (booking.isBlocked) return undefined;
  const user = booking.requestedByUser;
  if (!user) return undefined;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || user.name || undefined;
}

export function fromBookings(bookings: BookingInput[]): CalendarItem[] {
  return bookings
    .filter((booking) => booking.status === "approved" || booking.status === "pending")
    .map((booking) => ({
      key: `booking:${booking._id}`,
      source: "booking" as const,
      title: booking.isBlocked
        ? `${booking.resource?.name ?? "Resource"} unavailable`
        : booking.resource?.name ?? "Booking",
      ...resolveWhen(booking),
      description: booking.notes,
      bookingStatus: booking.status as "pending" | "approved",
      resourceName: booking.resource?.name,
      bookedBy: bookedByName(booking),
      bookingBlocked: booking.isBlocked === true,
      bookingDate: booking.startDate,
    }));
}

/** Every local day an item covers, as YYYY-MM-DD keys. */
export function coveredDays(item: CalendarItem): string[] {
  // All-day ends are exclusive; timed items ending exactly at midnight
  // shouldn't spill onto the next day either, so back both off by a beat.
  const lastMoment = new Date(item.end.getTime() - 1);
  const lastDay = lastMoment > item.start ? startOfDay(lastMoment) : startOfDay(item.start);
  return eachDayOfInterval({ start: startOfDay(item.start), end: lastDay }).map((day) =>
    format(day, "yyyy-MM-dd"),
  );
}

function compareItems(a: CalendarItem, b: CalendarItem): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const byStart = a.start.getTime() - b.start.getTime();
  if (byStart !== 0) return byStart;
  return a.title.localeCompare(b.title);
}

/**
 * The next `limit` items, soonest first, for summary views like the dashboard
 * card. Anything still running counts as upcoming: an all-day item today
 * started at midnight, so filtering on start alone would drop today's events
 * by mid-morning.
 */
export function selectUpcomingItems(
  items: CalendarItem[],
  limit: number,
  now: Date = new Date(),
): CalendarItem[] {
  return items
    .filter((item) => (item.endUnknown ? item.start >= now : item.end > now))
    // Chronological across days, unlike compareItems, which floats all-day
    // items to the top of a single day's agenda.
    .sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

/**
 * Group items under every day they cover (multi-day items appear on each),
 * all-day first then by start time within a day.
 */
export function groupItemsByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    for (const day of coveredDays(item)) {
      const list = map.get(day);
      if (list) {
        list.push(item);
      } else {
        map.set(day, [item]);
      }
    }
  }
  for (const list of map.values()) {
    list.sort(compareItems);
  }
  return map;
}

/** Human label for an item's source, used on badges and detail sheets. */
export function sourceLabel(item: CalendarItem): string {
  switch (item.source) {
    case "event":
      return item.eventTypeName ?? "Event";
    case "booking":
      return item.bookingStatus === "pending" ? "Booking · pending" : "Booking";
    default:
      return "Calendar";
  }
}

/** Month-grid chip classes, colour-coded by source (events use their type colour). */
export function itemChipClasses(item: CalendarItem): string {
  switch (item.source) {
    case "event":
      return `${eventTypeChip(item.eventTypeColor)} hover:opacity-80`;
    case "booking":
      return item.bookingStatus === "pending"
        ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-200 dark:hover:bg-yellow-900/60"
        : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-200 dark:hover:bg-green-900/60";
    default:
      return item.allDay
        ? "bg-purple-600 text-white hover:bg-purple-700"
        : "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:hover:bg-purple-900/60";
  }
}

/** Mobile month-grid dot colour per source. */
export function itemDotClass(item: CalendarItem): string {
  switch (item.source) {
    case "event":
      return eventTypeSwatch(item.eventTypeColor);
    case "booking":
      return item.bookingStatus === "pending" ? "bg-yellow-500" : "bg-green-500";
    default:
      return "bg-purple-500";
  }
}

/** Day-agenda accent (time column / badge text) per source. */
export function itemAccentTextClass(item: CalendarItem): string {
  switch (item.source) {
    case "event":
      return "text-blue-600 dark:text-blue-400";
    case "booking":
      return item.bookingStatus === "pending"
        ? "text-yellow-700 dark:text-yellow-400"
        : "text-green-700 dark:text-green-400";
    default:
      return "text-purple-600 dark:text-purple-400";
  }
}

function eventTypeChip(color?: string): string {
  return (color && eventTypeColors[color]?.chip) || eventTypeColors[defaultEventTypeColor].chip;
}

function eventTypeSwatch(color?: string): string {
  return (color && eventTypeColors[color]?.swatch) || eventTypeColors[defaultEventTypeColor].swatch;
}
