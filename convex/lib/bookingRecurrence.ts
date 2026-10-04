// Repeating bookings. Shared by the createBooking mutation and the request form,
// so the dates a member previews are exactly the dates that get booked.
//
// Every date is a plain YYYY-MM-DD string and all arithmetic is done in UTC, so
// no timezone or daylight-saving change can shift an occurrence by a day.

export type BookingRepeatFrequency = "weekly" | "fortnightly" | "monthly";

// A series can run at most a year past its first date. Long enough for a year of
// training nights; short enough that nobody holds a resource indefinitely.
export const MAX_SERIES_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS = ["1st", "2nd", "3rd", "4th"];

function toUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  return toDateStr(new Date(toUtc(dateStr).getTime() + days * DAY_MS));
}

/**
 * Which weekday-of-the-month the first date falls on: 1-4, or "last" for the
 * 29th onwards. A 5th Tuesday doesn't exist in most months, so it repeats as
 * the last Tuesday instead of silently skipping months.
 */
function weekOfMonth(dateStr: string): number | "last" {
  const nth = Math.ceil(toUtc(dateStr).getUTCDate() / 7);
  return nth >= 5 ? "last" : nth;
}

// The nth (or last) given weekday in a month, as a date string
function nthWeekdayOf(year: number, month: number, weekday: number, nth: number | "last"): string {
  if (nth === "last") {
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    const back = (lastDay.getUTCDay() - weekday + 7) % 7;
    return toDateStr(new Date(lastDay.getTime() - back * DAY_MS));
  }
  const first = new Date(Date.UTC(year, month, 1));
  const forward = (weekday - first.getUTCDay() + 7) % 7;
  return toDateStr(new Date(first.getTime() + (forward + (nth - 1) * 7) * DAY_MS));
}

/** Every date in the series, first date included, up to and including `untilDate`. */
export function seriesDates(
  startDate: string,
  frequency: BookingRepeatFrequency,
  untilDate: string,
): string[] {
  const dates: string[] = [];
  if (untilDate < startDate) return dates;

  if (frequency === "monthly") {
    const start = toUtc(startDate);
    const weekday = start.getUTCDay();
    const nth = weekOfMonth(startDate);
    for (let i = 0; ; i++) {
      const date = nthWeekdayOf(start.getUTCFullYear(), start.getUTCMonth() + i, weekday, nth);
      if (date > untilDate) break;
      dates.push(date);
    }
    return dates;
  }

  const step = frequency === "weekly" ? 7 : 14;
  for (let date = startDate; date <= untilDate; date = addDays(date, step)) {
    dates.push(date);
  }
  return dates;
}

/** "Every Tuesday", "Every 2nd Tuesday", "Monthly on the last Tuesday" */
export function describeRepeat(startDate: string, frequency: BookingRepeatFrequency): string {
  const weekday = WEEKDAYS[toUtc(startDate).getUTCDay()];
  if (frequency === "weekly") return `Every ${weekday}`;
  if (frequency === "fortnightly") return `Every second ${weekday}`;
  const nth = weekOfMonth(startDate);
  return `Monthly on the ${nth === "last" ? "last" : ORDINALS[nth - 1]} ${weekday}`;
}

/** Why a repeat can't be booked as asked, or null if it can. */
export function repeatProblem(startDate: string, untilDate: string): string | null {
  if (untilDate <= startDate) return "The repeat must end after the first date";
  if (untilDate > addDays(startDate, MAX_SERIES_DAYS)) {
    return "A booking can repeat for up to a year";
  }
  return null;
}
