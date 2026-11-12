import { query, mutation, internalQuery, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { moduleSettingAllows } from "./modules";
import {
  NOTIFICATION_CATEGORIES,
  NotificationCategory,
  categoryForType,
  isCategoryEnabled,
} from "./lib/notificationPrefs";

const categoryValidator = v.union(
  v.literal("availabilityReminders"),
  v.literal("statusChanges"),
  v.literal("events"),
  v.literal("dutyCrew"),
  v.literal("deployments"),
);

const prefRowValidator = v.object({
  key: categoryValidator,
  label: v.string(),
  description: v.string(),
  enabled: v.boolean(),
  // False when the member can't open the module, so the push never goes out
  // whatever the preference says.
  available: v.boolean(),
});

async function loadModuleMap(ctx: QueryCtx) {
  const settings = await ctx.db.query("moduleSettings").collect();
  return new Map(settings.map((m) => [m.moduleId, m]));
}

function canReceive(
  user: Doc<"users">,
  moduleMap: Map<string, Doc<"moduleSettings">>,
  moduleId: string,
): boolean {
  if (user.isDisabled) return false;
  if (user.isAdmin) return true;
  return moduleSettingAllows(user, moduleMap.get(moduleId));
}

function prefRows(user: Doc<"users">, moduleMap: Map<string, Doc<"moduleSettings">>) {
  return NOTIFICATION_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    description: c.description,
    enabled: isCategoryEnabled(user.notificationPrefs, c.key),
    available: canReceive(user, moduleMap, c.moduleId),
  }));
}

async function setPref(
  ctx: { db: any },
  user: Doc<"users">,
  category: NotificationCategory,
  enabled: boolean,
) {
  await ctx.db.patch(user._id, {
    notificationPrefs: { ...(user.notificationPrefs ?? {}), [category]: enabled },
  });
}

export const getMyNotificationPrefs = query({
  args: {},
  returns: v.array(prefRowValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user) return [];
    return prefRows(user, await loadModuleMap(ctx));
  },
});

export const setMyNotificationPref = mutation({
  args: { category: categoryValidator, enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    await setPref(ctx, user, args.category, args.enabled);
    return null;
  },
});

async function requireAdminUser(ctx: QueryCtx) {
  const actorId = await getAuthUserId(ctx);
  if (!actorId) throw new Error("You must be signed in");
  const actor = await ctx.db.get(actorId);
  if (!actor?.isAdmin) throw new Error("Only administrators can manage member notifications");
}

export const getUserNotificationPrefs = query({
  args: { userId: v.id("users") },
  returns: v.array(prefRowValidator),
  handler: async (ctx, args) => {
    await requireAdminUser(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) return [];
    return prefRows(user, await loadModuleMap(ctx));
  },
});

export const setUserNotificationPref = mutation({
  args: { userId: v.id("users"), category: categoryValidator, enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdminUser(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    await setPref(ctx, user, args.category, args.enabled);
    return null;
  },
});

/**
 * Of these users, which should NOT get a push of this type, and why. Types that
 * belong to no category (tests, admin broadcasts) are never filtered.
 */
export const pushBlockedUsers = internalQuery({
  args: { userIds: v.array(v.id("users")), notificationType: v.optional(v.string()) },
  returns: v.array(
    v.object({ userId: v.id("users"), reason: v.union(v.literal("muted_by_user"), v.literal("no_module_access")) }),
  ),
  handler: async (ctx, args) => {
    const category = categoryForType(args.notificationType);
    if (!category) return [];
    const moduleMap = await loadModuleMap(ctx);
    const blocked: { userId: Id<"users">; reason: "muted_by_user" | "no_module_access" }[] = [];
    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      if (!user) continue;
      if (!canReceive(user, moduleMap, category.moduleId)) {
        blocked.push({ userId, reason: "no_module_access" });
      } else if (!isCategoryEnabled(user.notificationPrefs, category.key)) {
        blocked.push({ userId, reason: "muted_by_user" });
      }
    }
    return blocked;
  },
});
