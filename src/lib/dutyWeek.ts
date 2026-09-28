/**
 * The duty week `weekOffset` weeks from `now`, in local time: Tuesday 00:00 to
 * Monday 23:59. It changes over on Tuesday because that is training night,
 * when the duty officer and duty crew hand over - so a crew that missed its
 * weekend checks can still catch up on the Monday night.
 *
 * `sunday` (end of day) is the day the week is named and keyed by: the
 * nth-Sunday crew rotation and saved station check weeks both hang off it.
 * Mirrors `weekWindow` in convex/stationChecks.ts.
 */
export const weekBoundaries = (weekOffset: number, now: Date = new Date()) => {
  const daysSinceTuesday = (now.getDay() + 5) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - daysSinceTuesday + weekOffset * 7);
  start.setHours(0, 0, 0, 0);
  const sunday = new Date(start);
  sunday.setDate(start.getDate() + 5);
  sunday.setHours(23, 59, 59, 999);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, sunday, end };
};
