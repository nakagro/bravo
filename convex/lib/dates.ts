// Renders a YYYY-MM-DD date string in Australian day-month-year order for
// display, since it's stored/compared in ISO order but read by non-technical
// members who expect DD-MM-YYYY.
export function formatDateAU(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}-${month}-${year}`;
}

// The brigade is in Victoria, so "this week" means a Melbourne week - but the
// Convex runtime is UTC (verified 2026-08-28), and `setHours`/`getDay` there
// operate on UTC. A Mon-Sun window built with those methods therefore runs
// Mon 10:00 AEST to the next Mon 09:59, which puts a Monday-morning station
// check or inventory run in the *previous* week - and Monday morning is when
// those actually happen. These helpers resolve real Australia/Melbourne wall
// clock instead, so the boundary lands on local midnight year-round.
//
// Unlike the hardcoded `+10` used in crons.ts and events.ts, this follows
// AEDT: the runtime ships full IANA tz data, so the offset is read from it.
const BRIGADE_TIME_ZONE = "Australia/Melbourne";

const zoneFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BRIGADE_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export type ZonedParts = {
  year: number;
  month: number; // 1-12, not the 0-11 the Date constructor wants
  day: number;
  hour: number;
  minute: number;
  second: number;
};

// The Melbourne wall-clock reading of an instant.
export function brigadeParts(timestamp: number): ZonedParts {
  const parts: Record<string, string> = {};
  for (const { type, value } of zoneFormatter.formatToParts(new Date(timestamp))) {
    parts[type] = value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Melbourne never uses 24:00, but en-US hour12:false emits "24" for
    // midnight in some ICU builds, so fold it rather than trusting it.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

// Melbourne's UTC offset in milliseconds at a given instant (+10h or +11h).
function brigadeOffset(timestamp: number): number {
  const p = brigadeParts(timestamp);
  const asIfUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Drop sub-second precision on both sides so the difference is the offset
  // alone rather than the instant's milliseconds.
  return asIfUTC - Math.floor(timestamp / 1000) * 1000;
}

// The instant at which a given Melbourne wall-clock time occurs. Two passes:
// the offset depends on the answer, so guess with the offset at the naive
// instant, then re-read the offset at the guess. Melbourne's DST switches at
// 02:00/03:00 on a Sunday, so no boundary this module asks for (Monday 00:00,
// Sunday 23:59:59.999) lands in a skipped or repeated hour.
export function brigadeTimestamp(
  year: number,
  month: number, // 1-12
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const guess = naive - brigadeOffset(naive);
  return naive - brigadeOffset(guess);
}

// Day of week in Melbourne, 0 = Sunday, matching Date#getDay.
export function brigadeDayOfWeek(timestamp: number): number {
  const p = brigadeParts(timestamp);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}
