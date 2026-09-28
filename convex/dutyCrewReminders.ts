import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { currentWeekItems, isResolved } from "./stationChecks";
import { effectiveAssignee, loadAllocationMap } from "./lib/stationCheckAllocations";
import { brigadeDayOfWeek, brigadeParts } from "./lib/dates";

// The duty week runs Tuesday to Monday (see weekWindow), and Monday night is
// when a crew catches up on anything the weekend didn't get to. This nudges
// the outgoing crew on the Monday afternoon, while there's still time.
export const REMINDER_WEEKDAY = 1; // Monday, 0 = Sunday
export const REMINDER_HOUR = 16; // 4pm Melbourne

// Crons run on a fixed UTC clock, so crons.ts fires this at both UTC hours
// that 4pm Melbourne can fall on (AEST and AEDT). Only the run that actually
// lands at 4pm Melbourne on the Monday sends anything.
export function isReminderTime(now: number) {
  return (
    brigadeDayOfWeek(now) === REMINDER_WEEKDAY &&
    brigadeParts(now).hour === REMINDER_HOUR
  );
}

const recipientValidator = v.object({
  userId: v.id("users"),
  mine: v.number(),
});

// Everyone on the running week's crew, with how many outstanding checks are
// allocated to each. Null when there's nothing to chase: no crew, or every
// check already ticked or marked N/A.
export const weekClosingRecipients = internalQuery({
  args: { now: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      crewName: v.string(),
      remaining: v.number(),
      recipients: v.array(recipientValidator),
    })
  ),
  handler: async (ctx, args) => {
    const current = await currentWeekItems(ctx, args.now);
    if (!current) return null;
    const { week, crew, isSpecial, items } = current;

    const outstanding = items.filter((item) => !isResolved(item));
    if (outstanding.length === 0) return null;

    // An all-crews week (5th Sunday) is everyone's week.
    const memberIds = isSpecial
      ? [...new Set((await ctx.db.query("dutyCrew").take(50)).flatMap((c) => c.members))]
      : crew.members;

    const allocations = await loadAllocationMap(ctx, week.start, crew._id);
    const mineBy = new Map<Id<"users">, number>();
    for (const item of outstanding) {
      const assignee = effectiveAssignee(item, allocations);
      if (assignee) mineBy.set(assignee, (mineBy.get(assignee) ?? 0) + 1);
    }

    const recipients = [];
    for (const userId of memberIds) {
      const user = await ctx.db.get(userId);
      if (!user || user.isDisabled) continue;
      recipients.push({ userId, mine: mineBy.get(userId) ?? 0 });
    }

    return {
      crewName: isSpecial ? "All duty crews" : crew.name,
      remaining: outstanding.length,
      recipients,
    };
  },
});

export function weekClosingMessage(remaining: number, mine: number) {
  const checks = (n: number) => `${n} station check${n === 1 ? "" : "s"}`;
  return mine > 0
    ? `${checks(remaining)} still to do, ${mine} of them allocated to you. The duty week ends at midnight tonight.`
    : `${checks(remaining)} still to do. The duty week ends at midnight tonight.`;
}

export const sendWeekClosingReminder = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    if (!isReminderTime(now)) return 0;

    const target = await ctx.runQuery(internal.dutyCrewReminders.weekClosingRecipients, { now });
    if (!target) return 0;

    let sent = 0;
    for (const recipient of target.recipients) {
      try {
        await ctx.runAction(api.pushNotificationAction.sendNotification, {
          title: `${target.crewName}: week ends tonight`,
          body: weekClosingMessage(target.remaining, recipient.mine),
          userId: recipient.userId,
          url: "/dutycrew",
          notificationType: "dutyCrewWeekClosing",
          source: "cron:dutyCrewWeekClosing",
        });
        sent++;
      } catch (err) {
        // One member's dead subscription shouldn't stop the rest
        console.error(`Duty crew reminder failed for ${recipient.userId}:`, err);
      }
    }
    return sent;
  },
});
