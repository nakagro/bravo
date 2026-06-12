import { formatWeekday, formatMonth, getDayNum, bookingStatusColors } from "../types";

/**
 * Calendar-tile style date badge used across booking lists.
 */
export function DateBadge({ dateStr }: { dateStr: string }) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-md bg-muted py-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide leading-tight text-muted-foreground">
        {formatWeekday(dateStr)}
      </span>
      <span className="text-base font-bold leading-tight text-foreground tabular-nums">
        {getDayNum(dateStr)}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide leading-tight text-muted-foreground">
        {formatMonth(dateStr)}
      </span>
    </div>
  );
}

/**
 * Section heading with a count and a rule line, matching the BA Skills tabs.
 */
export function SectionHeader({
  title,
  count,
  suffix,
}: {
  title: string;
  count?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
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
