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
import { BRIGADE_NAME } from "@/components/shared/crew/crewSeats";

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
 * An appliance crewed for the event. The brigade's own name is dropped so the
 * chip reads "Pumper" rather than repeating "Wyndham Vale" on every card.
 */
export function CrewBadge({
  applianceName,
  className = "",
}: {
  applianceName: string;
  className?: string;
}) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 ${className}`}
      title={applianceName}
    >
      {shortApplianceName(applianceName)}
    </span>
  );
}

export const shortApplianceName = (name: string) =>
  name.replace(new RegExp(`^${BRIGADE_NAME}\\s+`, "i"), "");

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
 * Marks a member as a team leader for this event - the person to find on the
 * day. Also explains, to the leader themselves, why they can see the organiser
 * controls on an event they'd otherwise have no admin rights over.
 *
 * `compact` is the inline form used inside a name chip, where it sits beside a
 * name rather than standing on its own.
 */
export function TeamLeaderBadge({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        title="Team leader"
        className={`text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 ${className}`}
      >
        Lead
      </span>
    );
  }
  return (
    <span
      className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full whitespace-nowrap bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ${className}`}
    >
      Team leader
    </span>
  );
}

/**
 * Attendance state for a past event: either the confirmed headcount, or a
 * prompt that nobody has confirmed it yet. The prompt is only shown to whoever
 * can act on it - to everyone else, an unconfirmed event just says nothing.
 */
export function AttendanceBadge({
  attendedCount,
  canManage = false,
  className = "",
}: {
  attendedCount: number | null;
  canManage?: boolean;
  className?: string;
}) {
  if (attendedCount === null) {
    if (!canManage) return null;
    return (
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 ${className}`}
      >
        Attendance not confirmed
      </span>
    );
  }
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 ${className}`}
    >
      {attendedCount} attended
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
