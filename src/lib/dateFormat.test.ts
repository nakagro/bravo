import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./dateFormat";

// 2026-11-15 03:15 UTC = 2:15 pm AEDT the same day.
const ts = Date.UTC(2026, 10, 15, 3, 15);

describe("formatDate", () => {
  it("shows day, short month and year on Melbourne time", () => {
    expect(formatDate(ts)).toBe("15 Nov 2026");
    expect(formatDate(new Date(ts))).toBe("15 Nov 2026");
  });
  it("keeps a late-evening UTC time on the Melbourne date", () => {
    expect(formatDate(Date.UTC(2026, 10, 14, 20, 0))).toBe("15 Nov 2026");
  });
});

describe("formatDateTime", () => {
  it("adds a 12-hour time", () => {
    expect(formatDateTime(ts).replace(/ /g, " ")).toBe("15 Nov 2026, 2:15 pm");
  });
});
