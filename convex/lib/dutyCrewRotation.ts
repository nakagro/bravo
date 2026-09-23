import { QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

// Resolve which crew covers the week ending on the given Sunday: a manual
// schedule override wins, otherwise the nth-Sunday-of-the-month rule (5th
// Sundays are special all-crews weeks, which fall back to crew 1). Mirrors
// getCurrentWeekCheckStatus.
//
// `sunday` is UTC midnight of the Sunday's calendar date - the key
// `dutyCrewSchedule.date` is written under, and what weekWindow().sunday
// returns.
export async function resolveCrewForSunday(
  ctx: QueryCtx,
  sunday: Date
): Promise<{ crew: Doc<"dutyCrew"> | null; isSpecial: boolean }> {
  const schedule = await ctx.db
    .query("dutyCrewSchedule")
    .withIndex("by_date", (q) => q.eq("date", sunday.getTime()))
    .first();
  if (schedule) {
    return {
      crew: await ctx.db.get(schedule.dutyCrewId),
      isSpecial: schedule.isSpecial,
    };
  }

  let sundayCount = 0;
  for (let i = 1; i <= sunday.getDate(); i++) {
    if (new Date(sunday.getFullYear(), sunday.getMonth(), i).getDay() === 0) {
      sundayCount++;
    }
  }
  const isSpecial = sundayCount === 5;
  const crew = await ctx.db
    .query("dutyCrew")
    .withIndex("by_number", (q) => q.eq("number", isSpecial ? 1 : sundayCount))
    .first();
  return { crew, isSpecial };
}
