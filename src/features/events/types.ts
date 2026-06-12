import { parse, format } from "date-fns";
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
