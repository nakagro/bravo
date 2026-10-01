import { format } from "date-fns";
import { NEXT_STATUS_OPTIONS } from "@/constants/statusOptions";

/**
 * Hand-mirrored from convex/plannedShifts.ts (the frontend doesn't import
 * across the boundary - see src/features/memberRecords/types.ts:3).
 */
export const HORIZON_DAYS = 92;

export type PlannedStatus = "not available" | "delayed response" | "WFH";
export type AfterStatus = (typeof NEXT_STATUS_OPTIONS)[number]["value"];

/** The statuses a shift type can set. "At station" variants are left out. */
export const PLANNED_STATUS_OPTIONS: { value: PlannedStatus; label: string }[] = [
  { value: "not available", label: "Not available" },
  { value: "delayed response", label: "Delayed response" },
  { value: "WFH", label: "WFH" },
];

/** Add Duration's "Then switch to" options, with "reset" worded for this form. */
export const AFTER_STATUS_OPTIONS = NEXT_STATUS_OPTIONS.map((option) =>
  option.value === "reset" ? { ...option, label: "Clear my status" } : option,
);

export function afterStatusLabel(value: string): string {
  return AFTER_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/**
 * Six fixed colours, indexed by the shift type's `colour`. Full class strings so
 * Tailwind keeps them.
 */
export const SHIFT_COLOURS = [
  { dot: "bg-sky-500", ring: "ring-sky-500" },
  { dot: "bg-violet-500", ring: "ring-violet-500" },
  { dot: "bg-amber-500", ring: "ring-amber-500" },
  { dot: "bg-emerald-500", ring: "ring-emerald-500" },
  { dot: "bg-rose-500", ring: "ring-rose-500" },
  { dot: "bg-slate-500", ring: "ring-slate-500" },
] as const;

export function shiftColour(index: number) {
  return SHIFT_COLOURS[index % SHIFT_COLOURS.length];
}

/** "2100" -> "21:00", or null if it isn't a valid 24-hour time. */
export function digitsToTime(digits: string): string | null {
  if (!/^\d{4}$/.test(digits)) return null;
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2));
  if (hours > 23 || minutes > 59) return null;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** "21:00" -> "2100" for the 4-digit input. */
export function timeToDigits(time: string): string {
  return time.replace(":", "");
}

/** Local YYYY-MM-DD, matching the backend's Melbourne date for members here. */
export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Convex error text without the server wrapper and stack. */
export function errorText(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong.";
  const match = /Uncaught Error: (.*)/.exec(error.message);
  return (match ? match[1] : error.message.split("\n")[0]) || "Something went wrong.";
}
