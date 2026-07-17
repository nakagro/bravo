import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  getRelativeTimeCompact,
  getRelativeTimeString,
} from "@/utils/dateUtils";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-17T12:00:00+10:00"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("getRelativeTimeCompact", () => {
  it("shows 'now' under a minute", () => {
    expect(getRelativeTimeCompact(Date.now() - 59_000)).toBe("now");
  });

  it("rolls to minutes at exactly 60 seconds", () => {
    expect(getRelativeTimeCompact(Date.now() - MINUTE)).toBe("1m ago");
  });

  it("shows minutes under an hour", () => {
    expect(getRelativeTimeCompact(Date.now() - 59 * MINUTE)).toBe("59m ago");
  });

  it("rolls to hours at exactly 60 minutes", () => {
    expect(getRelativeTimeCompact(Date.now() - 60 * MINUTE)).toBe("1h ago");
  });

  it("shows hours under a day", () => {
    expect(getRelativeTimeCompact(Date.now() - 23 * HOUR)).toBe("23h ago");
  });

  it("rolls to days at exactly 24 hours", () => {
    expect(getRelativeTimeCompact(Date.now() - 24 * HOUR)).toBe("1d ago");
  });

  it("shows days under a week", () => {
    expect(getRelativeTimeCompact(Date.now() - 6 * DAY)).toBe("6d ago");
  });

  it("falls back to a full date at 7 days and beyond", () => {
    expect(getRelativeTimeCompact(Date.now() - 8 * DAY)).toMatch(/2026/);
  });
});

describe("getRelativeTimeString", () => {
  it("pluralizes correctly at the singular boundaries", () => {
    expect(getRelativeTimeString(Date.now() - MINUTE)).toBe("1 minute ago");
    expect(getRelativeTimeString(Date.now() - 2 * MINUTE)).toBe(
      "2 minutes ago",
    );
    expect(getRelativeTimeString(Date.now() - HOUR)).toBe("1 hour ago");
    expect(getRelativeTimeString(Date.now() - DAY)).toBe("1 day ago");
  });

  it("shows 'Just now' under a minute", () => {
    expect(getRelativeTimeString(Date.now() - 30_000)).toBe("Just now");
  });
});
