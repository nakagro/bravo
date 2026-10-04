import { parse, format } from "date-fns";
import { enAU } from "date-fns/locale";
import { ConvexError } from "convex/values";

// Extract the clean conflict message from a structured booking error,
// or null if the error is not a booking conflict
export function getBookingConflictMessage(error: unknown): string | null {
  if (error instanceof ConvexError) {
    const data = error.data as { code?: string; message?: string } | string;
    if (typeof data === "object" && data?.code === "BOOKING_CONFLICT" && data.message) {
      return data.message;
    }
  }
  return null;
}

// The dates of a repeating booking that clash with existing bookings, or null
// if the error is not that refusal
export function getSeriesClash(
  error: unknown
): { clashDates: string[]; total: number } | null {
  if (error instanceof ConvexError) {
    const data = error.data as { code?: string; clashDates?: string[]; total?: number };
    if (data?.code === "SERIES_CLASH" && data.clashDates && data.total) {
      return { clashDates: data.clashDates, total: data.total };
    }
  }
  return null;
}

// A booking list with each repeating booking's dates gathered into one entry,
// in the position of its earliest date. Keeps a year of training nights from
// burying everything else in a list.
export type BookingGroup<T> =
  | { kind: "single"; booking: T }
  | { kind: "series"; seriesId: string; bookings: T[] };

export function groupBySeries<T extends { _id: string; startDate: string; seriesId?: string }>(
  bookings: T[]
): BookingGroup<T>[] {
  const sorted = [...bookings].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const groups: BookingGroup<T>[] = [];
  const bySeries = new Map<string, T[]>();
  for (const booking of sorted) {
    if (!booking.seriesId) {
      groups.push({ kind: "single", booking });
      continue;
    }
    const existing = bySeries.get(booking.seriesId);
    if (existing) {
      existing.push(booking);
    } else {
      const dates = [booking];
      bySeries.set(booking.seriesId, dates);
      groups.push({ kind: "series", seriesId: booking.seriesId, bookings: dates });
    }
  }
  // A series of one date left (the rest cancelled or past) reads as a booking
  return groups.map((group) =>
    group.kind === "series" && group.bookings.length === 1
      ? { kind: "single", booking: group.bookings[0] }
      : group
  );
}

// Time of day of a booking: "All day" or "7:00 PM - 9:00 PM"
export function formatBookingTime(booking: {
  isAllDay: boolean;
  startTime?: string;
  endTime?: string;
}): string {
  return booking.isAllDay || !booking.startTime || !booking.endTime
    ? "All day"
    : `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`;
}

// Booking status values
export type BookingStatus = "pending" | "approved" | "rejected" | "cancelled";

// Tab configuration for BookingsPage
export type BookingTab = "bookings" | "schedule" | "admin";

export const bookingTabs: { key: BookingTab; label: string }[] = [
  { key: "bookings", label: "My Bookings" },
  { key: "schedule", label: "Schedule" },
  { key: "admin", label: "Admin" },
];

// Status badge color classes
export const bookingStatusColors: Record<BookingStatus | string, string> = {
  pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  approved: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  rejected: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  cancelled: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
};

export function getStatusBadgeClasses(status: string): string {
  return bookingStatusColors[status] ?? bookingStatusColors.cancelled;
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
export function parseBookingDate(dateStr: string): Date {
  return parse(dateStr, "yyyy-MM-dd", new Date());
}

// Today as a YYYY-MM-DD string in the user's local timezone
// (toISOString() is UTC and lags AEST by ~10 hours)
export function getTodayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

// Format a YYYY-MM-DD string for display: "Mon 1 Jan"
export function formatShortDate(dateStr: string): string {
  return format(parseBookingDate(dateStr), "EEE d MMM", { locale: enAU });
}

// Format just the weekday: "Mon"
export function formatWeekday(dateStr: string): string {
  return format(parseBookingDate(dateStr), "EEE", { locale: enAU });
}

// Format just the month: "Jan"
export function formatMonth(dateStr: string): string {
  return format(parseBookingDate(dateStr), "MMM", { locale: enAU });
}

// Get the day number from a YYYY-MM-DD string
export function getDayNum(dateStr: string): number {
  return parseBookingDate(dateStr).getDate();
}

// Format time string (HH:MM) to 12-hour format
export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Format a booking's date/time range for display
export function formatBookingDate(booking: {
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
}): string {
  let dateStr = formatShortDate(booking.startDate);
  if (booking.endDate && booking.endDate !== booking.startDate) {
    dateStr += ` - ${formatShortDate(booking.endDate)}`;
  }

  if (booking.isAllDay) {
    return `${dateStr} (All day)`;
  } else if (booking.startTime && booking.endTime) {
    return `${dateStr}, ${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`;
  }

  return dateStr;
}

// Capitalize first letter of status for display
export function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Format a YYYY-MM-DD string for summary display: "Mon 1 Jan"
export function formatSummaryDate(dateStr: string): string {
  return format(parseBookingDate(dateStr), "EEE d MMM", { locale: enAU });
}
