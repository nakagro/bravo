import { describe, expect, it } from "vitest";
import { describeRepeat, repeatProblem, seriesDates } from "./bookingRecurrence";

describe("repeating booking dates", () => {
  it("repeats weekly, including the last date when it lands on it", () => {
    expect(seriesDates("2026-10-06", "weekly", "2026-10-27")).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
    ]);
  });

  it("repeats fortnightly across a month and daylight-saving boundary", () => {
    expect(seriesDates("2026-09-29", "fortnightly", "2026-10-27")).toEqual([
      "2026-09-29",
      "2026-10-13",
      "2026-10-27",
    ]);
  });

  it("repeats monthly on the same weekday of the month, not the same date", () => {
    // Tue 13 Oct 2026 is the 2nd Tuesday
    expect(seriesDates("2026-10-13", "monthly", "2027-01-31")).toEqual([
      "2026-10-13",
      "2026-11-10",
      "2026-12-08",
      "2027-01-12",
    ]);
  });

  it("treats a 5th weekday as the last one, so no month is skipped", () => {
    // Thu 29 Oct 2026 is the 5th Thursday; November has only four
    expect(seriesDates("2026-10-29", "monthly", "2026-12-31")).toEqual([
      "2026-10-29",
      "2026-11-26",
      "2026-12-31",
    ]);
  });

  it("describes the rule in words", () => {
    expect(describeRepeat("2026-10-06", "weekly")).toBe("Every Tuesday");
    expect(describeRepeat("2026-10-06", "fortnightly")).toBe("Every second Tuesday");
    expect(describeRepeat("2026-10-13", "monthly")).toBe("Monthly on the 2nd Tuesday");
    expect(describeRepeat("2026-10-29", "monthly")).toBe("Monthly on the last Thursday");
  });

  it("refuses a repeat that ends too soon or runs past a year", () => {
    expect(repeatProblem("2026-10-06", "2026-10-06")).toMatch(/after the first date/);
    expect(repeatProblem("2026-10-06", "2027-10-31")).toMatch(/up to a year/);
    expect(repeatProblem("2026-10-06", "2027-10-06")).toBeNull();
  });
});
