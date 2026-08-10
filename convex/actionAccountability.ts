import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireModuleAccess } from "./modules";
import { notifyEvent, resolveAudience } from "./lib/notifyEvent";

/**
 * Admin API for "who is accountable for this, and how do they hear about it".
 *
 * One row per condition key. Modules raising events through notifyEvent() read
 * this table, so adding a notification to a new module is configuration plus a
 * single notifyEvent() call - no new tables, mutations or admin screens.
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

/**
 * Send a sample of this notification to whoever presses the button.
 *
 * Deliberately addressed to the caller alone rather than the mapped audience:
 * a test that emails a dozen officers is a test nobody runs twice. Note this
 * also sidesteps the normal path's actor exclusion - an officer mapped to
 * their own key would otherwise never see their own test.
 *
 * It goes through `notifyEvent` rather than reimplementing delivery, so what
 * arrives is genuinely what a real event produces, down to the email template
 * and the Action Centre card.
 */
export const sendTestNotification = mutation({
  args: {
    conditionKey: v.string(),
    moduleId: v.string(),
    title: v.string(),
    url: v.string(),
  },
  returns: v.object({
    inApp: v.boolean(),
    emailedTo: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const userId = await requireModuleAccess(
      ctx,
      "admin",
      "You do not have access to manage notifications"
    );

    const mapping = await ctx.db
      .query("actionAccountability")
      .withIndex("by_conditionKey", (q) => q.eq("conditionKey", args.conditionKey))
      .first();

    // A test that fires while the real thing is switched off would be
    // misleading, so say what needs doing instead.
    if (!mapping || !mapping.isEnabled) {
      throw new Error("Turn these notifications on and press Save before sending a test.");
    }

    const notifyInApp = mapping.notifyInApp !== false;
    const notifyEmail = mapping.notifyEmail === true;
    if (!notifyInApp && !notifyEmail) {
      throw new Error("Pick at least one delivery method, then Save, before sending a test.");
    }

    const user = await ctx.db.get(userId);
    if (notifyEmail && !user?.email) {
      throw new Error("Your account has no email address, so the email test can't be delivered.");
    }

    const name =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.name ||
      "you";

    await notifyEvent(ctx, {
      moduleId: args.moduleId,
      conditionKey: args.conditionKey,
      title: `[TEST] ${args.title}`,
      description: "Sample notification - nothing has actually been submitted.",
      url: args.url,
      priority: "low",
      // Stable, so repeated tests replace each other instead of stacking up
      // in the Action Centre.
      sourceEntityId: `test:${args.conditionKey}`,
      actorUserId: userId,
      overrideRecipients: [userId],
      emailSubject: `[TEST] ${args.title}`,
      emailIntro: `This is a test of the "${args.title}" notification, sent to ${name} from the admin settings. A real one is sent automatically when the event happens.`,
      emailDetails: [
        { label: "Notification", value: args.title },
        { label: "Sent to", value: `${name} (test send - recipients aren't notified)` },
        { label: "Result", value: "Sample data · 2 need attention" },
      ],
      emailListTitle: "Needs attention",
      emailList: [
        "Sample item - not done: this is where an outstanding item appears",
        "Sample item - a note left against an item appears like this",
      ],
    });

    return {
      inApp: notifyInApp,
      emailedTo: notifyEmail ? user?.email ?? null : null,
    };
  },
});
