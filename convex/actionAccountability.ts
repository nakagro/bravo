import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireModuleAccess } from "./modules";
import { resolveAudience } from "./lib/notifyEvent";

/**
 * Admin API for "who is accountable for this, and how do they hear about it".
 *
 * One row per condition key. Modules raising events through notifyEvent() read
 * this table, so adding a notification to a new module is configuration plus a
 * single notifyEvent() call — no new tables, mutations or admin screens.
 */

const rankValidator = v.union(
  v.literal("Brigade Member"),
  v.literal("Probationary"),
  v.literal("Firefighter"),
  v.literal("Lieutenant"),
  v.literal("Captain")
);

const configValidator = v.object({
  conditionKey: v.string(),
  roles: v.array(v.string()),
  userIds: v.array(v.id("users")),
  minimumRank: v.optional(rankValidator),
  isEnabled: v.boolean(),
  notifyInApp: v.boolean(),
  notifyEmail: v.boolean(),
  /** Names of everyone the current settings resolve to, for the admin preview. */
  resolvedRecipientNames: v.array(v.string()),
});

export const getAccountability = query({
  args: { conditionKey: v.string() },
  returns: v.union(configValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const mapping = await ctx.db
      .query("actionAccountability")
      .withIndex("by_conditionKey", (q) => q.eq("conditionKey", args.conditionKey))
      .first();

    if (!mapping) {
      return {
        conditionKey: args.conditionKey,
        roles: [],
        userIds: [],
        minimumRank: undefined,
        isEnabled: false,
        notifyInApp: true,
        notifyEmail: false,
        resolvedRecipientNames: [],
      };
    }

    const { userIds } = await resolveAudience(ctx, args.conditionKey);
    const names: string[] = [];
    for (const id of userIds) {
      const user = await ctx.db.get(id);
      if (!user) continue;
      names.push(
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.name ||
          user.email ||
          "Unknown"
      );
    }

    return {
      conditionKey: mapping.conditionKey,
      roles: mapping.roles,
      userIds: mapping.userIds,
      minimumRank: mapping.minimumRank,
      isEnabled: mapping.isEnabled,
      notifyInApp: mapping.notifyInApp !== false,
      notifyEmail: mapping.notifyEmail === true,
      resolvedRecipientNames: names.sort((a, b) => a.localeCompare(b)),
    };
  },
});

export const setAccountability = mutation({
  args: {
    conditionKey: v.string(),
    roles: v.array(v.string()),
    userIds: v.array(v.id("users")),
    minimumRank: v.optional(rankValidator),
    isEnabled: v.boolean(),
    notifyInApp: v.boolean(),
    notifyEmail: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireModuleAccess(
      ctx,
      "admin",
      "You do not have access to manage notifications"
    );

    const existing = await ctx.db
      .query("actionAccountability")
      .withIndex("by_conditionKey", (q) => q.eq("conditionKey", args.conditionKey))
      .first();

    const fields = {
      conditionKey: args.conditionKey,
      roles: args.roles,
      userIds: args.userIds,
      minimumRank: args.minimumRank,
      isEnabled: args.isEnabled,
      notifyInApp: args.notifyInApp,
      notifyEmail: args.notifyEmail,
      updatedAt: Date.now(),
      updatedBy: userId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("actionAccountability", fields);
    }

    return null;
  },
});
