// Which nights the roll is called on. Every Tuesday is training, except the 2nd
// Tuesday of the month, which is the brigade monthly meeting. Shared by the
// backend and the Training page so both agree on what a date is.

import { addDays } from "./bookingRecurrence";

export type RollNightKind = "training" | "meeting" | "other";

const TUESDAY = 2;

function dayOfWeek(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isTuesday(date: string): boolean {
  return dayOfWeek(date) === TUESDAY;
}

/** The kind of a regular Tuesday: the 2nd of the month (8th-14th) is the meeting. */
export function tuesdayKind(date: string): "training" | "meeting" {
  const day = Number(date.slice(8, 10));
  return day >= 8 && day <= 14 ? "meeting" : "training";
}

/** Every Tuesday from `from` to `to`, inclusive. */
export function tuesdaysBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  let date = addDays(from, (TUESDAY - dayOfWeek(from) + 7) % 7);
  for (; date <= to; date = addDays(date, 7)) dates.push(date);
  return dates;
}

export const ROLL_NIGHT_LABELS: Record<RollNightKind, string> = {
  training: "Training",
  meeting: "Brigade Meeting",
  other: "Extra roll",
};
