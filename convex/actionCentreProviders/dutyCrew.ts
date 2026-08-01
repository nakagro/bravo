import { QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { ActionProvider } from "./types";

// Resolve which crew covers the week ending on the given Sunday: a manual
// schedule override wins, otherwise the nth-Sunday-of-the-month rule (5th
// Sundays are special all-crews weeks). Mirrors getCurrentWeekCheckStatus.
async function resolveCrewForSunday(
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

// A single gentle "you're on duty crew this week" reminder — deliberately one
// action for the whole week, never one per check item. Disappears once the
// week's checks are submitted.
export const dutyCrewProvider: ActionProvider = async (ctx, p) => {
  if (!p.hasModuleAccess("dutyCrew")) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sunday = new Date(today);
  const daysUntilSunday = today.getDay() === 0 ? 0 : 7 - today.getDay();
  sunday.setDate(today.getDate() + daysUntilSunday);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);

  const { crew, isSpecial } = await resolveCrewForSunday(ctx, sunday);
  if (!crew) return [];

  const isOnDuty = isSpecial
    ? (await ctx.db.query("dutyCrew").take(50)).some((c) =>
        c.members.includes(p.userId)
      )
    : crew.members.includes(p.userId);
  if (!isOnDuty) return [];

  const submission = await ctx.db
    .query("stationCheckSubmissions")
    .withIndex("by_date_and_dutyCrew", (q) =>
      q.eq("date", sunday.getTime()).eq("dutyCrewId", crew._id)
    )
    .order("desc")
    .first();
  if (submission?.status === "completed") return [];

  const remaining = submission
    ? submission.checkItems.filter(
        (item) => !item.isCompleted && item.isNotApplicable !== true
      ).length
    : undefined;

  const sundayLabel = sunday.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });

  return [
    {
      id: `dutyCrew:thisWeek:${sunday.getTime()}`,
      moduleId: "dutyCrew",
      kind: "dutyCrewWeek",
      title: isSpecial ? "All-Crews Duty Week" : "Your Duty Crew Week",
      description: isSpecial
        ? `All duty crew members attend this week (ending Sun ${sundayLabel}).`
        : `${crew.name} is on station duties for the week ending Sun ${sundayLabel}.`,
      url: "/duty-crew",
      actionLabel: "View checks",
      priority: "medium",
      count: remaining,
      createdAt: monday.getTime(),
      // Safe to wave away: the id carries this week's Sunday, so a dismissal
      // only silences the current week and next week's reminder is a new id.
      dismissible: true,
    },
  ];
};
