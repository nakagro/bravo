import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { moduleSettingAllows } from "../modules";
import { categoryForType, isCategoryEnabled } from "./notificationPrefs";
import { effectiveTemplate, type TemplateKey, type TemplateText } from "./notificationTemplates";

// Shared by assignment notices and event change notices.

/** The text each key sends now: the stored edit, or the default in code. */
export async function loadTemplates(ctx: QueryCtx): Promise<(key: TemplateKey) => TemplateText> {
  const rows = await ctx.db.query("notificationTemplates").take(200);
  const stored = new Map(rows.map((row) => [row.templateKey, row]));
  return (key) => effectiveTemplate(key, stored.get(key));
}

export async function loadModuleMap(ctx: QueryCtx) {
  const settings = await ctx.db.query("moduleSettings").collect();
  return new Map(settings.map((m) => [m.moduleId, m]));
}

export type ModuleMap = Awaited<ReturnType<typeof loadModuleMap>>;

/**
 * Why a member can't be told at all, or null when they can. The module gate
 * blocks both the push and the Action Centre item, so counting them as sent
 * would be wrong.
 */
export function unreachableReason(
  user: Doc<"users"> | null,
  moduleMap: ModuleMap,
  moduleId: string,
): string | null {
  if (!user) return "Account removed";
  if (user.isDisabled) return "Account disabled";
  if (user.isAdmin) return null;
  return moduleSettingAllows(user, moduleMap.get(moduleId)) ? null : "No access to this module";
}

export type PushState = "on" | "muted" | "noDevice";

/** Whether a reachable member will also get the push, for the confirm screen. */
export async function pushStateFor(
  ctx: QueryCtx,
  user: Doc<"users">,
  notificationType: string,
): Promise<PushState> {
  const category = categoryForType(notificationType);
  if (category && !isCategoryEnabled(user.notificationPrefs, category.key)) return "muted";
  const device = await ctx.db
    .query("pushSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  return device ? "on" : "noDevice";
}

export async function loadUsers(ctx: QueryCtx, ids: Iterable<Id<"users">>) {
  const users = new Map<Id<"users">, Doc<"users"> | null>();
  await Promise.all([...new Set(ids)].map(async (id) => users.set(id, await ctx.db.get(id))));
  return users;
}
