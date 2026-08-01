import { Id } from "../../../convex/_generated/dataModel";

/** What a kit item tracks. Mirrors `kitTracksValidator` in convex/lib/memberKit.ts. */
export type KitTracks = "size" | "serial" | "held" | "choice" | "date" | "note" | "count";

/** A chart/size pair, the value of a "size" item. */
export interface KitSizeValue {
  chartId: Id<"memberKitSizeCharts">;
  size: string;
}

/** Interpreted via the owning item's `tracks`; dates are YYYY-MM-DD strings. */
export type KitValue = string | number | boolean | KitSizeValue;

export interface KitSizeChart {
  _id: Id<"memberKitSizeCharts">;
  itemId: Id<"memberKitItems">;
  /** Absent when the item only ever comes in one make, so there is no brand to pick. */
  name?: string;
  order: number;
  sizes: string[];
}

export interface KitItemDef {
  _id: Id<"memberKitItems">;
  /** Absent means the item stands alone, in no set. */
  setId?: Id<"memberKitSets">;
  name: string;
  description?: string;
  order: number;
  tracks: KitTracks;
  options?: string[];
  isArchived: boolean;
  /** Non-empty only for "size" items. */
  charts: KitSizeChart[];
}

export interface KitSetDef {
  _id: Id<"memberKitSets">;
  name: string;
  description?: string;
  order: number;
  items: KitItemDef[];
}

export interface KitDefinitions {
  sets: KitSetDef[];
  standalone: KitItemDef[];
}

export const KIT_TRACKS: { value: KitTracks; label: string; hint: string }[] = [
  {
    value: "size",
    label: "Sized item",
    hint: "Brands or models with their own size ranges: jackets, boots, gloves. Pick a chart, then a size.",
  },
  { value: "serial", label: "Serial / text", hint: "Short free text, like a pager serial or an asset number" },
  { value: "held", label: "Issued / not issued", hint: "A yes/no: does this member have it?" },
  { value: "choice", label: "Choice", hint: "Pick one from a fixed list of options" },
  {
    value: "count",
    label: "Number",
    hint: "A whole number, like how many structural gear sets are allocated",
  },
  { value: "date", label: "Date", hint: "A calendar date, such as issued or expires" },
  { value: "note", label: "Long text", hint: "Multi-line notes" },
];

export const KIT_TRACKS_LABELS: Record<KitTracks, string> = Object.fromEntries(
  KIT_TRACKS.map((t) => [t.value, t.label]),
) as Record<KitTracks, string>;

/** The one type that carries a flat list of options. */
export function usesOptions(tracks: KitTracks): boolean {
  return tracks === "choice";
}

export function isSizeValue(value: KitValue | undefined | null): value is KitSizeValue {
  return typeof value === "object" && value !== null;
}

/**
 * Expand "7 to 12, half sizes" into a size list, so defining a range doesn't
 * mean typing out eleven options. Non-numeric scales (S/M/L) are entered by hand.
 */
export function generateSizeRange(from: number, to: number, step: number): string[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(step > 0)) return [];
  if (to < from) return [];
  // Guard against a typo like 1 to 1000 producing thousands of options.
  if ((to - from) / step > 200) return [];

  const sizes: string[] = [];
  // Integer arithmetic on a scaled value avoids 7.1 + 0.1 = 7.199999 artefacts.
  const scale = 1000;
  for (let v = Math.round(from * scale); v <= Math.round(to * scale); v += Math.round(step * scale)) {
    sizes.push(String(v / scale));
  }
  return sizes;
}

/**
 * Human-readable rendering of a recorded value. The backend already formats
 * values for profile cards and history; this covers the client-side drafts that
 * have not been saved yet.
 */
export function formatKitValue(item: KitItemDef, value: KitValue | undefined | null): string | null {
  if (value === undefined || value === null) return null;

  if (item.tracks === "size" && isSizeValue(value)) {
    const chart = item.charts.find((c) => c._id === value.chartId);
    return chart?.name ? `${chart.name} · ${value.size}` : value.size;
  }
  if (typeof value === "boolean") return value ? "Issued" : "Not issued";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return null;
}

/** Structural equality, so a draft that ended up back where it started isn't dirty. */
export function kitValuesEqual(a: KitValue | null, b: KitValue | null): boolean {
  if (a === null || b === null) return a === b;
  if (isSizeValue(a) || isSizeValue(b)) {
    if (!isSizeValue(a) || !isSizeValue(b)) return false;
    return a.chartId === b.chartId && a.size === b.size;
  }
  return a === b;
}
