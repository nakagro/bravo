import {
  type cronJobs,
  getFunctionName,
  makeFunctionReference,
  type SchedulableFunctionReference,
} from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { brigadeDayOfWeek, brigadeParts } from "./lib/dates";

// Crons that hold a Melbourne wall-clock time all year, daylight saving or not.
//
// The Convex cron API only takes fixed UTC times, so a job pinned to one UTC
// hour drifts an hour through AEDT. brigadeCron instead registers the job at
// both UTC hours its local hour can land on (AEDT and AEST) and points it at
// `dispatch` below, which reads the real Melbourne time and passes on only the
// run that matches. Every local-time job in crons.ts goes through this, so the
// daylight saving logic lives here and nowhere else.

export type BrigadeTime = {
  hour: number; // 0-23, Melbourne
  minute: number;
  dayOfWeek?: number; // 0 = Sunday, Melbourne; omit for every day
};

// The two UTC hours a Melbourne hour falls on: AEDT (UTC+11) then AEST (UTC+10).
export function brigadeUtcHours(hour: number): [number, number] {
  return [(hour + 13) % 24, (hour + 14) % 24];
}

export function isBrigadeCronTime(now: number, at: Omit<BrigadeTime, "minute">) {
  return (
    brigadeParts(now).hour === at.hour &&
    (at.dayOfWeek === undefined || brigadeDayOfWeek(now) === at.dayOfWeek)
  );
}

export function brigadeCron(
  crons: ReturnType<typeof cronJobs>,
  identifier: string,
  at: BrigadeTime,
  fn: SchedulableFunctionReference
) {
  // 02:00-02:59 does not exist on the October changeover Sunday and happens
  // twice on the April one, so a job there would skip a day and double-fire.
  // Every other hour matches exactly one of the two runs, every day.
  if (at.hour === 2) {
    throw new Error(`Cron "${identifier}": 02:00-02:59 is the daylight saving changeover hour`);
  }
  const [aedt, aest] = brigadeUtcHours(at.hour);
  // The weekday is left to the gate: the UTC day can differ from Melbourne's.
  crons.cron(identifier, `${at.minute} ${aedt},${aest} * * *`, internal.brigadeCron.dispatch, {
    hour: at.hour,
    dayOfWeek: at.dayOfWeek,
    fn: getFunctionName(fn),
  });
}

export const dispatch = internalMutation({
  args: {
    hour: v.number(),
    dayOfWeek: v.optional(v.number()),
    fn: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!isBrigadeCronTime(Date.now(), args)) return false;
    await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation" | "action">(args.fn), {});
    return true;
  },
});
