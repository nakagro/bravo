import { describe, expect, it } from "vitest";
import { compareUserNames, formatCountsSummary, formatHeadcount, formatCompactAgo, responseWasEdited } from "./types";

describe("compareUserNames", () => {
  it("sorts members by their displayed full name without case sensitivity", () => {
    const members = [
      { firstName: "Zoe", lastName: "Able" },
      { name: "alice Young" },
      { firstName: "Alice", lastName: "Zeal" },
    ];

    expect([...members].sort(compareUserNames)).toEqual([
      { name: "alice Young" },
      { firstName: "Alice", lastName: "Zeal" },
      { firstName: "Zoe", lastName: "Able" },
    ]);
  });

  it("uses natural numeric ordering", () => {
    const members = [{ name: "Member 10" }, { name: "Member 2" }];

    expect([...members].sort(compareUserNames).map((member) => member.name)).toEqual([
      "Member 2",
      "Member 10",
    ]);
  });
});

describe("formatCountsSummary with guests", () => {
  it("adds a guests clause only when someone is bringing someone", () => {
    expect(
      formatCountsSummary({ attending: 12, maybe: 0, notAttending: 1, guests: 4 })
    ).toBe("12 going · +4 guests · 1 not going");
    expect(formatCountsSummary({ attending: 12, maybe: 0, notAttending: 1, guests: 0 })).toBe(
      "12 going · 1 not going"
    );
    // Events that never asked pass no guests field at all
    expect(formatCountsSummary({ attending: 3, maybe: 0, notAttending: 0 })).toBe("3 going");
  });
});

describe("formatHeadcount", () => {
  it("spells out the split only when guests are coming", () => {
    expect(formatHeadcount(12, 0)).toBe("12");
    expect(formatHeadcount(12, 4)).toBe("16 · 12 members + 4 guests");
    expect(formatHeadcount(1, 1)).toBe("2 · 1 member + 1 guest");
  });
});

describe("formatCompactAgo", () => {
  const now = Date.now();
  it("keeps recent times to a single short token", () => {
    expect(formatCompactAgo(now - 30_000)).toBe("now");
    expect(formatCompactAgo(now - 35 * 60_000)).toBe("35m");
    expect(formatCompactAgo(now - 5 * 3_600_000)).toBe("5h");
    expect(formatCompactAgo(now - 3 * 86_400_000)).toBe("3d");
  });
  it("stays an age all the way down, never a calendar date", () => {
    expect(formatCompactAgo(now - 20 * 86_400_000)).toBe("3w");
    expect(formatCompactAgo(now - 120 * 86_400_000)).toBe("4mo");
    expect(formatCompactAgo(now - 800 * 86_400_000)).toBe("2y");
  });
});

describe("responseWasEdited", () => {
  it("ignores the write gap on a response that was never touched again", () => {
    const t = Date.now();
    expect(responseWasEdited(t, t + 200)).toBe(false);
    expect(responseWasEdited(t, t + 120_000)).toBe(true);
  });
});
