import { describe, expect, it } from "vitest";
import { toUtcMidnight, weekBoundaries } from "./types";

describe("weekBoundaries", () => {
  it("returns the Tue-Mon duty week containing a midweek day", () => {
    const { start, sunday, end } = weekBoundaries(0, new Date(2026, 7, 19, 14, 30)); // Wed 19 Aug 2026
    expect(start.getDay()).toBe(2);
    expect(start.getDate()).toBe(18);
    expect(start.getHours()).toBe(0);
    expect(sunday.getDate()).toBe(23);
    expect(end.getDay()).toBe(1);
    expect(end.getDate()).toBe(24);
    expect(end.getHours()).toBe(23);
  });

  it("keeps Monday in the week that is ending, until the Tuesday changeover", () => {
    const monday = weekBoundaries(0, new Date(2026, 7, 24, 20, 0)); // Mon 24 Aug 2026, 8pm
    expect(monday.start.getDate()).toBe(18);
    expect(monday.sunday.getDate()).toBe(23);

    const tuesday = weekBoundaries(0, new Date(2026, 7, 25, 0, 5)); // Tue 25 Aug 2026
    expect(tuesday.start.getDate()).toBe(25);
    expect(tuesday.sunday.getDate()).toBe(30);
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
