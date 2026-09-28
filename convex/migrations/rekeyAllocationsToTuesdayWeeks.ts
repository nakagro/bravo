import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { weekWindow } from "../stationChecks";

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * The duty week moved from Mon-Sun to Tue-Mon, so `weekStart` on existing
 * station check allocations (a Monday 00:00) no longer matches the key the
 * reads compute (a Tuesday 00:00), and a leader's allocations for the week
 * would drop off the checklist.
 *
 * Six days on from either key lands on the Sunday or Monday of the same duty
 * week, so re-deriving the start from there re-keys old rows and leaves
 * already-migrated ones where they are. Safe to run more than once.
 */
export const run = internalMutation({
  args: {},
  returns: v.object({ migrated: v.number(), alreadyCurrent: v.number() }),
  handler: async (ctx) => {
    const allocations = await ctx.db.query("stationCheckAllocations").take(2000);
    let migrated = 0;
    let alreadyCurrent = 0;

    for (const allocation of allocations) {
      const weekStart = weekWindow(allocation.weekStart + SIX_DAYS_MS).start;
      if (weekStart === allocation.weekStart) {
        alreadyCurrent += 1;
        continue;
      }
      await ctx.db.patch(allocation._id, { weekStart });
      migrated += 1;
    }

    return { migrated, alreadyCurrent };
  },
});
