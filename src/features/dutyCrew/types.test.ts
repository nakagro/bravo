import { describe, expect, it } from "vitest";
import { toUtcMidnight, weekBoundaries } from "./types";

describe("weekBoundaries", () => {
  it("returns the Mon-Sun window containing a midweek day", () => {
    const { monday, sunday } = weekBoundaries(0, new Date(2026, 7, 19, 14, 30)); // Wed 19 Aug 2026
    expect(monday.getDate()).toBe(17);
    expect(monday.getHours()).toBe(0);
    expect(sunday.getDate()).toBe(23);
    expect(sunday.getHours()).toBe(23);
  });

  it("keeps Sunday in the week that is ending, not the one starting", () => {
    const { monday, sunday } = weekBoundaries(0, new Date(2026, 7, 23, 9, 0)); // Sun 23 Aug 2026
    expect(monday.getDate()).toBe(17);
    expect(sunday.getDate()).toBe(23);
  });

  it("steps whole weeks for a non-zero offset", () => {
    const back = weekBoundaries(-2, new Date(2026, 7, 19, 14, 30));
    expect(back.sunday.getDate()).toBe(9);
    const forward = weekBoundaries(1, new Date(2026, 7, 19, 14, 30));
    expect(forward.sunday.getDate()).toBe(30);
  });
});

describe("toUtcMidnight", () => {
  // Convex runs in UTC. Sending a local midnight puts the server on the
  // previous day in AEST, which made getDutyCrewForDate return null for
  // every week.
  it("keeps the local calendar date and lands on UTC midnight", () => {
    for (const offset of [-3, -1, 0, 1, 4]) {
      const { sunday } = weekBoundaries(offset, new Date(2026, 7, 19, 14, 30));
      const utc = new Date(toUtcMidnight(sunday));

      expect(utc.getUTCDay()).toBe(0);
      expect(utc.getUTCFullYear()).toBe(sunday.getFullYear());
      expect(utc.getUTCMonth()).toBe(sunday.getMonth());
      expect(utc.getUTCDate()).toBe(sunday.getDate());
      expect(utc.getUTCHours()).toBe(0);
      expect(utc.getUTCMinutes()).toBe(0);
    }
  });
});
