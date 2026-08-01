import { describe, expect, it } from "vitest";
import { Id } from "../../../convex/_generated/dataModel";
import { KitItemDef, formatKitValue, generateSizeRange, kitValuesEqual } from "./types";

const chartId = "chart1" as Id<"memberKitSizeCharts">;
const otherChartId = "chart2" as Id<"memberKitSizeCharts">;

function sizedItem(overrides: Partial<KitItemDef> = {}): KitItemDef {
  return {
    _id: "item1" as Id<"memberKitItems">,
    setId: "set1" as Id<"memberKitSets">,
    name: "Structural gloves",
    order: 1,
    tracks: "size",
    isArchived: false,
    charts: [
      {
        _id: chartId,
        itemId: "item1" as Id<"memberKitItems">,
        name: "Supplier A",
        order: 1,
        sizes: ["9", "10"],
      },
    ],
    ...overrides,
  };
}

describe("generateSizeRange", () => {
  it("expands whole and half size ranges", () => {
    expect(generateSizeRange(8, 11, 1)).toEqual(["8", "9", "10", "11"]);
    expect(generateSizeRange(7, 9, 0.5)).toEqual(["7", "7.5", "8", "8.5", "9"]);
  });

  it("avoids floating point artefacts across a long half-size run", () => {
    const sizes = generateSizeRange(7, 12, 0.5);
    expect(sizes).toHaveLength(11);
    expect(sizes).toContain("7.5");
    expect(sizes.some((size) => size.includes("0000"))).toBe(false);
  });

  it("returns nothing for nonsense or runaway ranges", () => {
    expect(generateSizeRange(12, 7, 1)).toEqual([]);
    expect(generateSizeRange(1, 5, 0)).toEqual([]);
    expect(generateSizeRange(1, 10000, 1)).toEqual([]);
    expect(generateSizeRange(Number.NaN, 5, 1)).toEqual([]);
  });
});

describe("formatKitValue", () => {
  it("renders a sized value as chart and size", () => {
    expect(formatKitValue(sizedItem(), { chartId, size: "10" })).toBe("Supplier A · 10");
  });

  it("falls back to the bare size when the chart has gone", () => {
    expect(formatKitValue(sizedItem({ charts: [] }), { chartId, size: "10" })).toBe("10");
  });

  it("renders held as a sentence, not a bare yes/no", () => {
    const workwear = sizedItem({ tracks: "held", charts: [] });
    expect(formatKitValue(workwear, true)).toBe("Issued");
    expect(formatKitValue(workwear, false)).toBe("Not issued");
  });

  it("renders a count, including a recorded zero", () => {
    const sets = sizedItem({ tracks: "count", charts: [] });
    expect(formatKitValue(sets, 2)).toBe("2");
    expect(formatKitValue(sets, 0)).toBe("0");
  });

  it("returns null for a value that was never recorded", () => {
    expect(formatKitValue(sizedItem(), undefined)).toBeNull();
    expect(formatKitValue(sizedItem(), null)).toBeNull();
  });

  it("renders text, choice and date values verbatim", () => {
    expect(formatKitValue(sizedItem({ tracks: "serial", charts: [] }), "EM-4471-93")).toBe(
      "EM-4471-93",
    );
    expect(formatKitValue(sizedItem({ tracks: "date", charts: [] }), "2026-03-01")).toBe(
      "2026-03-01",
    );
  });
});

describe("kitValuesEqual", () => {
  it("treats a matching chart and size as unchanged", () => {
    expect(kitValuesEqual({ chartId, size: "10" }, { chartId, size: "10" })).toBe(true);
    expect(kitValuesEqual({ chartId, size: "10" }, { chartId, size: "9" })).toBe(false);
    expect(kitValuesEqual({ chartId, size: "10" }, { chartId: otherChartId, size: "10" })).toBe(
      false,
    );
  });

  it("separates a recorded false from nothing recorded", () => {
    expect(kitValuesEqual(false, null)).toBe(false);
    expect(kitValuesEqual(null, null)).toBe(true);
    expect(kitValuesEqual(false, false)).toBe(true);
  });

  it("does not confuse a size value with a plain string", () => {
    expect(kitValuesEqual({ chartId, size: "10" }, "10")).toBe(false);
  });
});
