import {
  formatWeekday,
  formatMonth,
  getDayNum,
  eventStatusColors,
  rsvpStatusColors,
  rsvpStatusLabels,
  eventTypeChipClasses,
  RsvpStatus,
} from "../types";

/**
 * Category chip for an event. Prefers the structured type (name + colour);
 * falls back to the legacy free-text category (default colour) for older
 * events that predate configurable types. Renders nothing when neither is set.
 */
export function EventTypeChip({
  typeInfo,
  legacyType,
  className = "",
  uppercase = false,
}: {
  typeInfo?: { name: string; color: string } | null;
  legacyType?: string;
  className?: string;
  uppercase?: boolean;
}) {
  const name = typeInfo?.name ?? legacyType;
  if (!name) return null;
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${eventTypeChipClasses(
        typeInfo?.color
      )} ${uppercase ? "uppercase tracking-wider" : ""} ${className}`}
    >
      {name}
    </span>
  );
}

/**
 * Calendar-tile style date badge used across event lists.
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

/**
 * Status chip for an event. Only cancelled events get a badge - "active" is
 * the unremarkable default.
 */
export function EventStatusBadge({ status, className = "" }: { status: string; className?: string }) {
  if (status === "active") return null;
  const colors = eventStatusColors[status] ?? eventStatusColors.cancelled;
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${colors} ${className}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/**
 * Small indicator that an event collects per-shift interest rather than a
 * simple yes/maybe/no.
 */
export function ShiftsBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 ${className}`}
    >
      Shifts
    </span>
  );
}

/**
 * Small indicator that member responses are closed - the organiser has set the
 * roster, so there's no point looking for an RSVP prompt on this one.
 */
export function SetListBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 ${className}`}
    >
      Set list
    </span>
  );
}

/**
 * Chip showing an RSVP status.
 */
export function RsvpBadge({ status, className = "" }: { status: RsvpStatus; className?: string }) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${rsvpStatusColors[status]} ${className}`}
    >
      {rsvpStatusLabels[status]}
    </span>
  );
}
