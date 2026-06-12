import { formatWeekday, formatMonth, getDayNum, bookingStatusColors } from "../types";

/**
 * Calendar-tile style date badge used across booking lists.
 */
export function DateBadge({ dateStr }: { dateStr: string }) {
  return (
    <div className="text-center min-w-[50px] bg-gray-100 dark:bg-gray-700 rounded-lg py-1.5 px-2">
      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {formatWeekday(dateStr)}
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
        {getDayNum(dateStr)}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
        {formatMonth(dateStr)}
      </div>
    </div>
  );
}

// Diagonal stripes: the calendar idiom for "unavailable", keeping red free
// for actions and genuine errors
const blockedChipClasses =
  "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 " +
  "[background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,0.08)_3px,rgba(0,0,0,0.08)_6px)] " +
  "dark:[background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,0.08)_3px,rgba(255,255,255,0.08)_6px)]";

/**
 * Status chip for a booking. Blocked bookings get a striped neutral
 * treatment instead of a status color.
 */
export function StatusBadge({
  status,
  isBlocked,
  className = "",
}: {
  status: string;
  isBlocked?: boolean;
  className?: string;
}) {
  const label = isBlocked ? "Blocked" : status.charAt(0).toUpperCase() + status.slice(1);
  const colors = isBlocked
    ? blockedChipClasses
    : (bookingStatusColors[status] ?? bookingStatusColors.cancelled);
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${colors} ${className}`}
    >
      {label}
    </span>
  );
}
