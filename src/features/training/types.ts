import { format, parse } from "date-fns";
import { enAU } from "date-fns/locale";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { formatRank } from "../../../convex/lib/ranks";
import { ROLL_NIGHT_LABELS, type RollNightKind } from "../../../convex/lib/rollNights";

export type RosterEntry = FunctionReturnType<typeof api.training.getRoster>[number];
export type MarkStatus = "present" | "apology" | "absent";

export type TrainingTab = "roll" | "previous" | "attendance" | "members";

// In the order an officer reaches for them: tonight, what's been, the totals,
// then the list of who gets called (set up once, rarely touched)
export const trainingTabs: { key: TrainingTab; label: string; manageOnly: boolean }[] = [
  { key: "roll", label: "Roll", manageOnly: false },
  { key: "previous", label: "Previous", manageOnly: true },
  { key: "attendance", label: "Attendance", manageOnly: true },
  { key: "members", label: "Members", manageOnly: true },
];

export const MARK_LABELS: Record<MarkStatus, string> = {
  present: "Present",
  apology: "Apology",
  absent: "Absent",
};

export function personName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/** "1st Lieutenant", "Firefighter", or "" for a member with no rank */
export function rankLabel(entry: Pick<RosterEntry, "rank" | "lieutenantNumber">): string {
  return formatRank({
    rank: entry.rank ?? undefined,
    lieutenantNumber: entry.lieutenantNumber ?? undefined,
  });
}

export function nightLabel(night: { kind: RollNightKind; title: string | null }): string {
  return night.title ?? ROLL_NIGHT_LABELS[night.kind];
}

const parseDate = (date: string) => parse(date, "yyyy-MM-dd", new Date());

/** "Tue 6 Oct" */
export function formatNightDate(date: string): string {
  return format(parseDate(date), "EEE d MMM", { locale: enAU });
}

/** "Tuesday 6 October 2026" */
export function formatNightDateLong(date: string): string {
  return format(parseDate(date), "EEEE d MMMM yyyy", { locale: enAU });
}

/** "October 2026", from "2026-10" */
export function formatNightMonth(month: string): string {
  return format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy", { locale: enAU });
}

export function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function shiftDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

/** Present as a share of the nights a member was marked for, e.g. "75%" */
export function attendanceRate(row: { present: number; apology: number; absent: number }): number {
  const total = row.present + row.apology + row.absent;
  return total === 0 ? 0 : Math.round((row.present / total) * 100);
}

// ─── CSV ────────────────────────────────────────────────────────────────────

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Hands the browser a CSV file to save. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  // The BOM makes Excel read the file as UTF-8, so names with accents survive
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
