import { parse, format, formatDistanceToNow } from "date-fns";
import { enAU } from "date-fns/locale";

// RSVP status values
export type RsvpStatus = "attending" | "notAttending" | "maybe";

// Event status values
export type EventStatus = "active" | "cancelled";

// Tab configuration for EventsPage
export type EventTab = "upcoming" | "past" | "admin";

export const eventTabs: { key: EventTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "admin", label: "Admin" },
];

// Status badge color classes
export const eventStatusColors: Record<EventStatus | string, string> = {
  active: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  cancelled: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
};

// RSVP badge color classes
export const rsvpStatusColors: Record<RsvpStatus, string> = {
  attending: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  maybe: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  notAttending: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
};

export const rsvpStatusLabels: Record<RsvpStatus, string> = {
  attending: "Going",
  maybe: "Maybe",
  notAttending: "Not going",
};

// ─── Event type colours ──────────────────────────────────────────────────────
// Admin-chosen palette key stored on each eventType. `chip` styles the category
// pill; `swatch` is the solid dot used in the colour picker.
export const eventTypeColors: Record<string, { label: string; chip: string; swatch: string }> = {
  blue: {
    label: "Blue",
    chip: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    swatch: "bg-blue-500",
  },
  green: {
    label: "Green",
    chip: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    swatch: "bg-green-500",
  },
  amber: {
    label: "Amber",
    chip: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
    swatch: "bg-amber-500",
  },
  red: {
    label: "Red",
    chip: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
    swatch: "bg-red-500",
  },
  purple: {
    label: "Purple",
    chip: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
    swatch: "bg-purple-500",
  },
  teal: {
    label: "Teal",
    chip: "bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200",
    swatch: "bg-teal-500",
  },
  pink: {
    label: "Pink",
    chip: "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200",
    swatch: "bg-pink-500",
  },
  gray: {
    label: "Gray",
    chip: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
    swatch: "bg-gray-500",
  },
};

export const eventTypeColorKeys = Object.keys(eventTypeColors);
export const defaultEventTypeColor = "blue";

// Chip classes for a type's colour key, falling back to blue for unknown keys
// (and for legacy free-text categories that have no colour).
export function eventTypeChipClasses(color?: string | null): string {
  return (color && eventTypeColors[color]?.chip) || eventTypeColors[defaultEventTypeColor].chip;
}

// Compact "going / maybe / not going" summary for cards, with a friendly empty
// state when nobody has responded yet.
export function formatCountsSummary(counts: {
  attending: number;
  maybe: number;
  notAttending: number;
  guests?: number;
}): string {
  if (counts.attending === 0 && counts.maybe === 0 && counts.notAttending === 0) {
    return "No responses yet";
  }
  const guests = counts.guests ?? 0;
  return [
    `${counts.attending} going`,
    ...(guests > 0 ? [`+${guests} ${guests === 1 ? "guest" : "guests"}`] : []),
    ...(counts.maybe > 0 ? [`${counts.maybe} maybe`] : []),
    ...(counts.notAttending > 0 ? [`${counts.notAttending} not going`] : []),
  ].join(" · ");
}

// Total heads for catering: members going plus the guests they're bringing.
// Only worth spelling out when somebody is actually bringing someone.
export function formatHeadcount(attending: number, guests: number): string {
  if (guests <= 0) return `${attending}`;
  return `${attending + guests} · ${attending} ${attending === 1 ? "member" : "members"} + ${guests} ${
    guests === 1 ? "guest" : "guests"
  }`;
}

// "+2" suffix for a name chip in the attending list.
export function formatGuestSuffix(count: number | undefined): string {
  return count && count > 0 ? ` +${count}` : "";
}

// Initials for avatar chips: "Shaun Gordon" → "SG"
export function getInitials(
  user: { firstName?: string; lastName?: string; name?: string } | null | undefined
): string {
  if (user?.firstName && user?.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  const name = user?.name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    return parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return "?";
}

// Format user display name from user object
export function formatUserName(
  user: { firstName?: string; lastName?: string; name?: string } | null | undefined
): string {
  if (user?.firstName && user?.lastName) {
    return `${user.firstName} ${user.lastName}`;
  } else if (user?.name) {
    return user.name;
  }
  return "Unknown User";
}

const userNameCollator = new Intl.Collator("en-AU", {
  numeric: true,
  sensitivity: "base",
});

/** Sort members alphabetically by the same full display name shown in the UI. */
export function compareUserNames(
  a: { firstName?: string; lastName?: string; name?: string },
  b: { firstName?: string; lastName?: string; name?: string }
): number {
  return userNameCollator.compare(formatUserName(a), formatUserName(b));
}

// Parse a YYYY-MM-DD string to a local Date (avoids timezone issues)
export function parseEventDate(dateStr: string): Date {
  return parse(dateStr, "yyyy-MM-dd", new Date());
}

// Today as a YYYY-MM-DD string in the user's local timezone
// (toISOString() is UTC and lags AEST by ~10 hours)
export function getTodayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

// Format a YYYY-MM-DD string for display: "Mon 1 Jan"
export function formatShortDate(dateStr: string): string {
  return format(parseEventDate(dateStr), "EEE d MMM", { locale: enAU });
}

// Format just the weekday: "Mon"
export function formatWeekday(dateStr: string): string {
  return format(parseEventDate(dateStr), "EEE", { locale: enAU });
}

// Format just the month: "Jan"
export function formatMonth(dateStr: string): string {
  return format(parseEventDate(dateStr), "MMM", { locale: enAU });
}

// Format month + year for list grouping headers: "January 2026"
export function formatMonthYear(dateStr: string): string {
  return format(parseEventDate(dateStr), "MMMM yyyy", { locale: enAU });
}

// Get the day number from a YYYY-MM-DD string
export function getDayNum(dateStr: string): number {
  return parseEventDate(dateStr).getDate();
}

// Format time string (HH:MM) to 12-hour format
export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// ─── Shifts / slots ──────────────────────────────────────────────────────────

export interface EventSlotLike {
  startTime?: string;
  endTime?: string;
  date?: string;
}

// "Mon 1 Jan · 9:00 AM – 12:00 PM", "9:00 AM – 12:00 PM", "Mon 1 Jan", or "".
export function formatSlotWhen(slot: EventSlotLike): string {
  const parts: string[] = [];
  if (slot.date) parts.push(formatShortDate(slot.date));
  if (slot.startTime && slot.endTime) {
    parts.push(`${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`);
  } else if (slot.startTime) {
    parts.push(formatTime(slot.startTime));
  }
  return parts.join(" · ");
}

// Coverage count for a slot: "2 of 4" when a target is set, else just "2".
// Callers append the noun (e.g. "rostered" / "placed").
export function slotCoverageLabel(count: number, target?: number): string {
  return target && target > 0 ? `${count} of ${target}` : `${count}`;
}

// Format an event's date/time range for display
export function formatEventDate(event: {
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
}): string {
  let dateStr = formatShortDate(event.startDate);
  if (event.endDate && event.endDate !== event.startDate) {
    dateStr += ` - ${formatShortDate(event.endDate)}`;
  }

  if (event.isAllDay) {
    return `${dateStr} (All day)`;
  } else if (event.startTime && event.endTime) {
    return `${dateStr}, ${formatTime(event.startTime)} - ${formatTime(event.endTime)}`;
  } else if (event.startTime) {
    return `${dateStr}, ${formatTime(event.startTime)}`;
  }

  return dateStr;
}

// ─── Response timing ─────────────────────────────────────────────────────────

// A response counts as edited once the two timestamps diverge. The one-minute
// tolerance absorbs the createdAt/updatedAt gap on a row that was only ever
// written once.
export function responseWasEdited(respondedAt: number, changedAt: number): boolean {
  return changedAt - respondedAt >= 60_000;
}

// "2m", "5h", "3d", "3w", "5mo", "2y" - always an age, never a calendar date.
// The column answers one question ("how long ago?") and a date in the middle of
// it makes the reader switch units mid-scan and do the subtraction themselves.
//
// The response list is one row per member and is read on a phone, so the row
// shows this token alone and the full sentence lives in its title.
export function formatCompactAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks}w`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(days / 365)}y`;
}

// The long form, for a title attribute: the whole story in one sentence, read
// only by whoever hovers or long-presses the row.
export function formatResponseTiming(respondedAt: number, changedAt: number): string {
  const answered = `Answered ${formatDistanceToNow(new Date(respondedAt), { addSuffix: true })}`;
  if (!responseWasEdited(respondedAt, changedAt)) return answered;
  return `${answered}, changed ${formatDistanceToNow(new Date(changedAt), { addSuffix: true })}`;
}
