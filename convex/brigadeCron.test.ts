// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { brigadeCron, brigadeUtcHours, isBrigadeCronTime } from "./brigadeCron";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Which of a day's two UTC runs pass the gate for a Melbourne hour. `day` is
// the Melbourne date; hours of 14 and up land on the previous UTC day's evening.
function matchingRuns(day: string, hour: number, dayOfWeek?: number) {
  const midnightUtc = Date.parse(`${day}T00:00:00Z`);
  return brigadeUtcHours(hour).map((utcHour) => {
    const offsetHours = utcHour > hour ? utcHour - 24 : utcHour;
    return isBrigadeCronTime(midnightUtc + offsetHours * 3_600_000, { hour, dayOfWeek });
  });
}

describe("brigade cron timing", () => {
  it("picks the AEST run in winter and the AEDT run in summer", () => {
    expect(matchingRuns("2026-07-15", 10)).toEqual([false, true]);
    expect(matchingRuns("2026-10-15", 10)).toEqual([true, false]);
    expect(matchingRuns("2026-07-15", 4)).toEqual([false, true]);
    expect(matchingRuns("2026-10-15", 4)).toEqual([true, false]);
  });

  it("runs every schedulable hour exactly once on both changeover days", () => {
    // AEDT ends Sun 5 Apr 2026 and starts Sun 4 Oct 2026
    for (const day of ["2026-04-05", "2026-10-04"]) {
      for (let hour = 0; hour < 24; hour++) {
        if (hour === 2) continue;
        expect(matchingRuns(day, hour).filter(Boolean), `${day} ${hour}:00`).toHaveLength(1);
      }
    }
  });

  it("holds a weekday in Melbourne time", () => {
    // Mon 12 Oct 2026 4pm, then the Tuesday
    expect(matchingRuns("2026-10-12", 16, 1)).toEqual([true, false]);
    expect(matchingRuns("2026-10-13", 16, 1)).toEqual([false, false]);
    // Monday 4am Melbourne is still Sunday in UTC
    expect(matchingRuns("2026-10-12", 4, 1)).toEqual([true, false]);
  });

  it("registers both UTC hours and refuses the changeover hour", () => {
    const crons = cronJobs();
    const fn = internal.plannedShifts.cleanupOldPlannedShifts;
    brigadeCron(crons, "ten", { hour: 10, minute: 0 }, fn);
    expect(crons.crons.ten.schedule).toMatchObject({ type: "cron", cron: "0 23,0 * * *" });
    expect(() => brigadeCron(crons, "two", { hour: 2, minute: 30 }, fn)).toThrow();
  });
});

describe("brigade cron dispatch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function dispatchAt(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(iso));
    const t = convexTest(schema, modules);
    const ran = await t.mutation(internal.brigadeCron.dispatch, {
      hour: 10,
      fn: "plannedShifts:cleanupOldPlannedShifts",
    });
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    return { ran, scheduled: scheduled.length };
  }

  it("passes on the run that is 10am in Melbourne", async () => {
    expect(await dispatchAt("2026-10-14T23:00:00Z")).toEqual({ ran: true, scheduled: 1 });
  });

  it("drops the run that is 11am in Melbourne", async () => {
    expect(await dispatchAt("2026-10-15T00:00:00Z")).toEqual({ ran: false, scheduled: 0 });
  });
});
