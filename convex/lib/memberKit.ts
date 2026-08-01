import { v } from "convex/values";
import type { Infer } from "convex/values";

/**
 * What a kit item tracks. Seven shapes, deliberately: a jacket has a brand and
 * a size, a pager has a serial, station workwear is a yes/no. Multi-select was
 * dropped: nothing the brigade orders needed it, and it made the member form
 * read like a spreadsheet.
 */
export const kitTracksValidator = v.union(
  v.literal("size"), // chart (brand/model) + one of its sizes
  v.literal("serial"), // single-line text
  v.literal("held"), // yes / no, as in "has station workwear"
  v.literal("choice"), // one of options[]
  v.literal("date"), // calendar date, "YYYY-MM-DD"
  v.literal("note"), // multiline free text
  v.literal("count"), // whole number, as in "structural gear sets allocated"
);

export type KitTracks = Infer<typeof kitTracksValidator>;

/**
 * A recorded value, interpreted via its item's `tracks`. Dates are plain
 * "YYYY-MM-DD" calendar strings rather than epoch ms so a timezone can never
 * shift an issue date. A missing entry row means "not recorded", which stays
 * distinct from a recorded `false`.
 */
export const kitValueValidator = v.union(
  v.string(), // serial, note, choice, date
  v.number(), // count
  v.boolean(), // held
  v.object({ chartId: v.id("memberKitSizeCharts"), size: v.string() }), // size
);

export type KitValue = Infer<typeof kitValueValidator>;

/** Why a history row exists. A clear is not an edit, even though both end with no value. */
export const kitHistoryReasonValidator = v.union(
  v.literal("edited"),
  v.literal("cleared"),
  v.literal("itemDeleted"),
  v.literal("chartDeleted"),
  v.literal("setDeleted"),
);

export type KitHistoryReason = Infer<typeof kitHistoryReasonValidator>;

/** A `size` value, narrowed from the union. */
export function isKitSizeValue(
  value: KitValue | null | undefined,
): value is { chartId: import("../_generated/dataModel").Id<"memberKitSizeCharts">; size: string } {
  return typeof value === "object" && value !== null;
}

/** Structural equality, used to skip writes (and history) for no-op edits. */
export function kitValuesEqual(a: KitValue | null, b: KitValue | null): boolean {
  if (a === null || b === null) return a === b;
  if (isKitSizeValue(a) || isKitSizeValue(b)) {
    if (!isKitSizeValue(a) || !isKitSizeValue(b)) return false;
    return a.chartId === b.chartId && a.size === b.size;
  }
  return a === b;
}
