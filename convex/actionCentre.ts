import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { isSharedAccount } from "./lib/accountType";
import { moduleSettingAllows } from "./modules";
import { availabilityProvider } from "./actionCentreProviders/availability";
import { profileProvider } from "./actionCentreProviders/profile";
import { bookingApprovalsProvider } from "./actionCentreProviders/bookings";
import { eventRsvpProvider } from "./actionCentreProviders/events";
import { baSkillsLmsProvider } from "./actionCentreProviders/baSkills";
import { dutyCrewProvider } from "./actionCentreProviders/dutyCrew";
import { noticesProvider } from "./actionCentreProviders/notices";
import { assignmentsProvider } from "./actionCentreProviders/assignments";
import type { ActionItem, ActionProvider, ProviderCtx } from "./actionCentreProviders/types";

// ─── Provider registry ────────────────────────────────────────────────────────

// Providers that raise a *member's* personal obligation are skipped for shared
// accounts - the DO phone has no availability, no skills profile and no RSVP.
// Duty-driven providers stay: they fire only on a notice addressed to the
// account or an officer module it would have to be deliberately granted.
const providers: Array<{ run: ActionProvider; membersOnly?: boolean }> = [
  { run: availabilityProvider, membersOnly: true },
  { run: profileProvider, membersOnly: true },
  { run: bookingApprovalsProvider },
  { run: eventRsvpProvider, membersOnly: true },
  { run: baSkillsLmsProvider },
  { run: dutyCrewProvider, membersOnly: true },
  // Notices are addressed to named recipients, so they're never a broadcast a
  // shared account could stumble into - no membersOnly gate needed.
  { run: noticesProvider },
  // Receipts of assignment notices, addressed to the member by name.
  { run: assignmentsProvider },
];

// ─── Validators ───────────────────────────────────────────────────────────────

const actionItemValidator = v.object({
  id: v.string(),
  moduleId: v.string(),
  kind: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  url: v.string(),
  actionLabel: v.optional(v.string()),
  priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  count: v.optional(v.number()),
  createdAt: v.number(),
  meta: v.optional(v.any()),
  dismissible: v.optional(v.boolean()),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireSignedIn(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in");
  return userId;
}

function buildModuleAccessChecker(
  user: Doc<"users">,
  moduleMap: Map<string, Doc<"moduleSettings">>
): (moduleId: string) => boolean {
  if (user.isAdmin) return () => true;

  return (moduleId: string) => {
    return moduleSettingAllows(user, moduleMap.get(moduleId));
  };
}

function sortActions(actions: ActionItem[]): ActionItem[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...actions].sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return a.createdAt - b.createdAt;
  });
}

// ─── Public query: getMyActions ───────────────────────────────────────────────

export const getMyActions = query({
  args: {},
  returns: v.array(actionItemValidator),
  handler: async (ctx): Promise<ActionItem[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user) return [];

    const allModuleSettings = await ctx.db.query("moduleSettings").collect();
    const moduleMap = new Map(allModuleSettings.map((m) => [m.moduleId, m]));
    const hasModuleAccess = buildModuleAccessChecker(user, moduleMap);

    const providerCtx: ProviderCtx = { user, userId, hasModuleAccess };

    const active = isSharedAccount(user)
      ? providers.filter((p) => !p.membersOnly)
      : providers;

    const results = await Promise.all(
      active.map((p) => p.run(ctx, providerCtx).catch(() => [] as ActionItem[]))
    );

    // Dismissals are keyed on the action's stable id, so a derived action whose
    // id encodes a period (this week's duty reminder) comes back on its own when
    // the period rolls over and the id changes.
    const dismissed = new Set(
      (
        await ctx.db
          .query("actionDismissals")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(500)
      ).map((d) => d.actionId)
    );

    return sortActions(results.flat().filter((a) => !dismissed.has(a.id)));
  },
});

/**
 * Hide one action for the calling user. Only honours actions the provider marked
 * dismissible, so this can't be used to silence a genuine outstanding obligation.
 */
export const dismissAction = mutation({
  args: { actionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireSignedIn(ctx);
    await dismissFor(ctx, userId, args.actionId);
    return null;
  },
});

/** "Clear all" on the Updates list - one transaction instead of one per card. */
export const dismissActions = mutation({
  args: { actionIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireSignedIn(ctx);
    if (args.actionIds.length > 200) throw new Error("Too many actions to dismiss at once");
    for (const actionId of args.actionIds) {
      await dismissFor(ctx, userId, actionId);
    }
    return null;
  },
});

async function dismissFor(ctx: MutationCtx, userId: Id<"users">, actionId: string) {
  const existing = await ctx.db
    .query("actionDismissals")
    .withIndex("by_user_and_action", (q) =>
      q.eq("userId", userId).eq("actionId", actionId)
    )
    .first();
  if (existing) return;

  await ctx.db.insert("actionDismissals", {
    userId,
    actionId,
    dismissedAt: Date.now(),
  });
}
