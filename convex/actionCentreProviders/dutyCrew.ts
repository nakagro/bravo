import { ActionProvider } from "./types";
import { resolveCrewForSunday } from "../lib/dutyCrewRotation";
import { findSubmissionForWeek, weekWindow } from "../stationChecks";

// A single gentle "you're on duty crew this week" reminder - deliberately one
// action for the whole week, never one per check item. Runs until the week
// closes on its own (closeElapsedWeeks), or drops off early once every item is
// ticked or marked N/A - there is no "submit" left to wait for.
export const dutyCrewProvider: ActionProvider = async (ctx, p) => {
  if (!p.hasModuleAccess("dutyCrew")) return [];

  const { start: weekStart, sunday } = weekWindow(Date.now());

  const { crew, isSpecial } = await resolveCrewForSunday(ctx, sunday);
  if (!crew) return [];

  const isOnDuty = isSpecial
    ? (await ctx.db.query("dutyCrew").take(50)).some((c) =>
        c.members.includes(p.userId)
      )
    : crew.members.includes(p.userId);
  if (!isOnDuty) return [];

  // Matched on the week window, not an exact date key: submissions are keyed
  // to Sunday 23:59 Melbourne, which an exact UTC-midnight lookup never hit.
  const submission = await findSubmissionForWeek(ctx, Date.now(), crew._id);

  const remaining = submission
    ? submission.checkItems.filter(
        (item) => !item.isCompleted && item.isNotApplicable !== true
      ).length
    : undefined;
  if (remaining === 0) return [];

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
      // Route is /dutycrew (no hyphen); This Week is the default tab, which
      // lands straight on the tickable station checks.
      url: "/dutycrew",
      actionLabel: "Tick off checks",
      priority: "medium",
      count: remaining,
      createdAt: weekStart,
      // Safe to wave away: the id carries this week's Sunday, so a dismissal
      // only silences the current week and next week's reminder is a new id.
      dismissible: true,
    },
  ];
};
