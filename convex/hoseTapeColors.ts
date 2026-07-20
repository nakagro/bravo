import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  convertLegacyTapeColor,
  isHexColor,
  tapeColorValidator,
} from "./lib/tapeColors";

/**
 * List all year -> tape colour mappings, newest year first.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // One row per test year, so this table stays tiny indefinitely.
    const mappings = await ctx.db.query("hoseTapeColors").take(1000);
    return mappings
      .sort((a, b) => b.year - a.year)
      .map((mapping) => ({
        _id: mapping._id,
        _creationTime: mapping._creationTime,
        year: mapping.year,
        color:
          mapping.tapeColor ?? convertLegacyTapeColor(mapping.color ?? "Red"),
        updatedBy: mapping.updatedBy,
        updatedAt: mapping.updatedAt,
      }));
  },
  returns: v.array(
    v.object({
      _id: v.id("hoseTapeColors"),
      _creationTime: v.number(),
      year: v.number(),
      color: tapeColorValidator,
      updatedBy: v.id("users"),
      updatedAt: v.number(),
    }),
  ),
});

/**
 * Set (or change) the tape colour for a given test year.
 */
export const upsert = mutation({
  args: {
    year: v.number(),
    color: tapeColorValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (
      !isHexColor(args.color.primary) ||
      (args.color.secondary !== undefined && !isHexColor(args.color.secondary))
    ) {
      throw new Error("Tape colours must be six-digit hex values");
    }

    const existing = await ctx.db
      .query("hoseTapeColors")
      .withIndex("by_year", (q) => q.eq("year", args.year))
      .unique();

    const timestamp = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        color: undefined,
        tapeColor: args.color,
        updatedBy: userId,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("hoseTapeColors", {
        year: args.year,
        tapeColor: args.color,
        updatedBy: userId,
        updatedAt: timestamp,
      });
    }
    return null;
  },
  returns: v.null(),
});

/**
 * Remove a year's tape colour mapping.
 */
export const remove = mutation({
  args: {
    id: v.id("hoseTapeColors"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.delete(args.id);
    return null;
  },
  returns: v.null(),
});
