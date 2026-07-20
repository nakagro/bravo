import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { convertLegacyTapeColor } from "../lib/tapeColors";

/**
 * Converts the small year-to-tape lookup table from fixed colour names to the
 * custom palette shape. The live query remains dual-read compatible until this
 * has been run in every deployment.
 */
export const run = internalMutation({
  args: {},
  returns: v.object({ migrated: v.number(), alreadyCurrent: v.number() }),
  handler: async (ctx) => {
    const mappings = await ctx.db.query("hoseTapeColors").take(1000);
    let migrated = 0;
    let alreadyCurrent = 0;

    for (const mapping of mappings) {
      if (mapping.tapeColor !== undefined) {
        alreadyCurrent += 1;
        continue;
      }

      await ctx.db.patch(mapping._id, {
        color: undefined,
        tapeColor: convertLegacyTapeColor(mapping.color ?? "Red"),
      });
      migrated += 1;
    }

    return { migrated, alreadyCurrent };
  },
});
