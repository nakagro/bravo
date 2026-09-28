import { ActionProvider } from "./types";
import { currentWeekItems, isResolved } from "../stationChecks";
import { effectiveAssignee, loadAllocationMap } from "../lib/stationCheckAllocations";

// A single gentle "you're on duty crew this week" reminder - deliberately one
// action for the whole week, never one per check item. Runs until the week
// closes on its own (closeElapsedWeeks), or drops off early once every item is
// ticked or marked N/A - there is no "submit" left to wait for.
//
// The week is the Tuesday-to-Monday duty week (see weekWindow), so on a Monday
// this is still the outgoing crew's reminder and the next crew's appears on
// the Tuesday, when they take over.
export const dutyCrewProvider: ActionProvider = async (ctx, p) => {
  if (!p.hasModuleAccess("dutyCrew")) return [];

  const now = Date.now();
  const current = await currentWeekItems(ctx, now);
  if (!current) return [];
  const { week, crew, isSpecial, items } = current;

  const isOnDuty = isSpecial
    ? (await ctx.db.query("dutyCrew").take(50)).some((c) =>
        c.members.includes(p.userId)
      )
    : crew.members.includes(p.userId);
  if (!isOnDuty) return [];

  const outstanding = items.filter((item) => !isResolved(item));
  if (outstanding.length === 0) return [];

  // The leader's allocations, so a member can see their own share. Counted
  // from the same outstanding items, so it can never exceed the total.
  const allocations = await loadAllocationMap(ctx, week.start, crew._id);
  const mine = outstanding.filter(
    (item) => effectiveAssignee(item, allocations) === p.userId
  ).length;

  // Labelled by its Sunday, how members know the week, even though it runs on
  // to the Monday night. `sunday` is a civil date held as UTC midnight.
  const sundayLabel = week.sunday.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const mineNote = mine > 0 ? ` ${mine} of the checks left are allocated to you.` : "";

  return [
    {
      id: `dutyCrew:thisWeek:${week.sunday.getTime()}`,
      moduleId: "dutyCrew",
      kind: "dutyCrewWeek",
      title: isSpecial ? "All-Crews Duty Week" : "Your Duty Crew Week",
      description: isSpecial
        ? `All duty crew members attend this week (ending Sun ${sundayLabel}).${mineNote}`
        : `${crew.name} is on station duties for the week ending Sun ${sundayLabel}.${mineNote}`,
      // Route is /dutycrew (no hyphen); This Week is the default tab, which
      // lands straight on the tickable station checks.
      url: "/dutycrew",
      actionLabel: "Tick off checks",
      priority: "medium",
      count: outstanding.length,
      createdAt: week.start,
      // Safe to wave away: the id carries this week's Sunday, so a dismissal
      // only silences the current week and next week's reminder is a new id.
      dismissible: true,
    },
  ];
};
