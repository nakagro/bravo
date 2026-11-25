import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Who may call what. Every public function starts with one of these.
 *
 * - `requireUser`: a signed-in account that is approved and not disabled.
 * - `requireAdmin`: the same, with `isAdmin` or `isSuperAdmin`.
 * - `requireSuperAdmin`: the same, with `isSuperAdmin`.
 * - `requireModule`: the same, and passes the module's Module Settings gate
 *   (superAdminOnly, allowedUserIds, rank and role), the gate the frontend uses
 *   to show the page. Super admins always pass; regular admins pass unless the
 *   module is marked `superAdminOnly`.
 *
 * Each has a `get*` twin that returns null instead of throwing. Queries use the
 * twin and return an empty result, so a widget a member can't see renders empty
 * rather than crashing the page. Mutations use the throwing form.
 */

type Ctx = QueryCtx | MutationCtx;

/**
 * The single rank ladder. It lived in three places (two in modules.ts, one in
 * the member records module) and every new rank meant finding all of them.
 */
export const RANK_ORDER: Record<string, number> = {
  "Brigade Member": 0,
  Probationary: 1,
  Firefighter: 2,
  Lieutenant: 3,
  Captain: 4,
};

/** One tier above admin: can lock modules from regular admins and manage super admins. */
export function isSuperAdmin(user: Pick<Doc<"users">, "isSuperAdmin">): boolean {
  return user.isSuperAdmin === true;
}

/** Regular admin or super admin. */
export function isAdminUser(user: Pick<Doc<"users">, "isAdmin" | "isSuperAdmin">): boolean {
  return user.isAdmin === true || user.isSuperAdmin === true;
}

/** Lieutenant and Captain: the officers. */
export function isOfficer(user: Pick<Doc<"users">, "rank">): boolean {
  return !!user.rank && RANK_ORDER[user.rank] >= RANK_ORDER.Lieutenant;
}

/** Waiting for an admin to approve a self-service sign-up. Absent means approved. */
export function isPendingApproval(user: Pick<Doc<"users">, "approvalStatus">): boolean {
  return user.approvalStatus === "pending";
}

/** Approved and not disabled. The floor for every signed-in function. */
export function isActiveAccount(
  user: Pick<Doc<"users">, "isDisabled" | "approvalStatus">,
): boolean {
  return user.isDisabled !== true && !isPendingApproval(user);
}

/**
 * Does this non-bypass user satisfy a module's gate? A missing or disabled
 * module denies. Super admins always pass; regular admins are handled in
 * `userAllowsModuleSetting` so `superAdminOnly` can lock them out while
 * non-super-admin modules keep existing admin bypass behavior.
 *
 * When `allowedUserIds` contains the user on an enabled module, access is
 * granted regardless of rank, roles, `adminOnly`, or `superAdminOnly`.
 *
 * When both a role list and a minimum rank are set, `requirementMode` decides
 * how they combine: "all" (the default, and what every row written before this
 * field existed means) requires both, "any" requires either. "any" exists for
 * gates like Events Admin, where the officers qualify on rank and the social
 * crew qualify on role, and nobody should need both.
 */
export function moduleSettingAllows(
  user: Doc<"users">,
  moduleSetting: Doc<"moduleSettings"> | null | undefined,
): boolean {
  // A disabled or unapproved account keeps its rank and roles (so re-enabling
  // is a single switch) but reaches nothing while it's off - including
  // admin-only and super-admin-only modules.
  if (!isActiveAccount(user)) return false;
  if (isSuperAdmin(user)) return true;
  if (!moduleSetting || !moduleSetting.isEnabled) return false;
  if (moduleSetting.allowedUserIds?.includes(user._id)) return true;
  if (moduleSetting.superAdminOnly) return false;
  if (moduleSetting.adminOnly && !isAdminUser(user)) return false;

  const hasRoleReq = !!(moduleSetting.requiredRoles && moduleSetting.requiredRoles.length > 0);
  const hasRankReq = !!moduleSetting.minimumRank;

  let roleOk = true;
  if (hasRoleReq) {
    const userRoles = user.roles || [];
    roleOk = moduleSetting.requiredRoles!.some((role: string) => userRoles.includes(role));
  }

  let rankOk = true;
  if (hasRankReq) {
    const userRank = user.rank;
    rankOk = userRank ? RANK_ORDER[userRank] >= RANK_ORDER[moduleSetting.minimumRank!] : false;
  }

  // The mode only means anything when there are two requirements to combine.
  if (hasRoleReq && hasRankReq && moduleSetting.requirementMode === "any") {
    return roleOk || rankOk;
  }

  return roleOk && rankOk;
}

/**
 * Full module gate evaluation including admin and super-admin rules.
 * - Disabled or pending accounts are always denied.
 * - Super admins always pass.
 * - Regular admins pass unless the module is `superAdminOnly`, in which case
 *   they only pass if the module is enabled and explicitly lists them in
 *   `allowedUserIds`.
 * - Non-admins are evaluated by `moduleSettingAllows`.
 */
export function userAllowsModuleSetting(
  user: Doc<"users">,
  moduleSetting: Doc<"moduleSettings"> | null | undefined,
): boolean {
  if (!isActiveAccount(user)) return false;
  if (isSuperAdmin(user)) return true;
  if (isAdminUser(user)) {
    if (!moduleSetting?.superAdminOnly) return true;
    return !!moduleSetting.isEnabled && !!moduleSetting.allowedUserIds?.includes(user._id);
  }
  return moduleSettingAllows(user, moduleSetting);
}

/** The signed-in, approved, enabled user, or null. */
export async function getActiveUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user || !isActiveAccount(user)) return null;
  return user;
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("You must be signed in");
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("User not found");
  if (user.isDisabled) throw new ConvexError("This account has been disabled");
  if (isPendingApproval(user)) {
    throw new ConvexError("Your account is waiting for an administrator to approve it");
  }
  return user;
}

export async function getAdmin(ctx: Ctx): Promise<Doc<"users"> | null> {
  const user = await getActiveUser(ctx);
  return user && isAdminUser(user) ? user : null;
}

export async function requireAdmin(ctx: Ctx, action?: string): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdminUser(user)) {
    throw new ConvexError(action ? `Only administrators can ${action}` : "Admin access required");
  }
  return user;
}

export async function getSuperAdmin(ctx: Ctx): Promise<Doc<"users"> | null> {
  const user = await getActiveUser(ctx);
  return user && isSuperAdmin(user) ? user : null;
}

export async function requireSuperAdmin(ctx: Ctx, action?: string): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isSuperAdmin(user)) {
    throw new ConvexError(
      action ? `Only super administrators can ${action}` : "Super admin access required",
    );
  }
  return user;
}

/**
 * Guard any admin action targeting another user: regular admins may never
 * modify a super administrator's account, role, rank, auth, or preferences.
 */
export function assertCanManageTargetUser(
  actor: Pick<Doc<"users">, "isSuperAdmin">,
  target: Pick<Doc<"users">, "isSuperAdmin">,
  action?: string,
): void {
  if (isSuperAdmin(target) && !isSuperAdmin(actor)) {
    throw new ConvexError(
      action
        ? `Only super administrators can ${action} for a super administrator`
        : "Only super administrators can modify a super administrator account",
    );
  }
}

/** Lieutenant, Captain or admin. */
export async function requireOfficer(ctx: Ctx, action?: string): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdminUser(user) && !isOfficer(user)) {
    throw new ConvexError(
      action ? `Only officers can ${action}` : "Only officers can do this",
    );
  }
  return user;
}

async function moduleSettingFor(ctx: Ctx, moduleId: string) {
  return await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
    .first();
}

/** Does this (already active) user pass the module's gate? */
export async function userHasModule(
  ctx: Ctx,
  user: Doc<"users">,
  moduleId: string,
): Promise<boolean> {
  if (!isActiveAccount(user)) return false;
  if (isSuperAdmin(user)) return true;
  return userAllowsModuleSetting(user, await moduleSettingFor(ctx, moduleId));
}

/** The caller, if they may use the module; null otherwise. Passes if any module matches. */
export async function getModuleUser(
  ctx: Ctx,
  ...moduleIds: string[]
): Promise<Doc<"users"> | null> {
  const user = await getActiveUser(ctx);
  if (!user) return null;
  for (const moduleId of moduleIds) {
    if (await userHasModule(ctx, user, moduleId)) return user;
  }
  return null;
}

/**
 * Throw unless the caller passes the module's gate. The gate lives in data so
 * officers can retune rank/role requirements from the Admin UI without a code
 * change. Passing several module ids allows any of them.
 */
export async function requireModule(
  ctx: Ctx,
  moduleIds: string | string[],
  denialMessage = "You do not have access to this",
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  for (const moduleId of Array.isArray(moduleIds) ? moduleIds : [moduleIds]) {
    if (await userHasModule(ctx, user, moduleId)) return user;
  }
  throw new ConvexError(denialMessage);
}

/**
 * Drop every live session for a user, so an account that was just disabled,
 * deleted or had its password reset stops working on devices that are already
 * signed in. Refresh tokens hang off sessions and must go with them.
 */
export async function revokeSessions(ctx: MutationCtx, userId: Id<"users">) {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  for (const session of sessions) {
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of refreshTokens) {
      await ctx.db.delete(token._id);
    }
    await ctx.db.delete(session._id);
  }
}

/** For values interpolated into email HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Unbiased random digits from the platform CSPRNG. */
export function randomDigits(length: number): string {
  let out = "";
  const buf = new Uint32Array(1);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    // Reject the top sliver so every digit is equally likely.
    if (buf[0] >= 4_294_967_290) continue;
    out += String(buf[0] % 10);
  }
  return out;
}

/** A URL-safe random token from the platform CSPRNG. */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A kiosk tablet's PIN session: valid, active, and allowed the kiosk module.
 * PIN sessions exist for the kiosk screens only, so this is the one check any
 * function that serves the kiosk makes. Returns the service account or null.
 */
export async function getKioskServiceAccount(
  ctx: Ctx,
  serviceToken: string | undefined,
): Promise<Doc<"serviceAccounts"> | null> {
  const token = serviceToken?.trim();
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const session = await ctx.db
    .query("serviceAccountSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (!session || session.expiresAt < Date.now()) return null;
  const account = await ctx.db.get(session.serviceAccountId);
  if (!account || !account.isActive || !account.allowedModules.includes("kiosk")) return null;
  return account;
}
