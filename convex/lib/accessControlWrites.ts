/**
 * The server-side kill switch for Access Control writes, read from Convex
 * environment variables so it works even when nobody can sign in to BRAVO.
 * It applies to everyone, administrators included.
 *
 * - ACCESS_CONTROL_WRITES_DISABLED blocks every site.
 * - ACCESS_CONTROL_WRITES_DISABLED_<SITE> (e.g. _SATELLITE, _MAIN) blocks one.
 *
 * A value of 1, true, yes or on (any case) turns the switch on. Anything else,
 * including unset, leaves writes allowed.
 */

export const ACCESS_WRITES_DISABLED_ENV = "ACCESS_CONTROL_WRITES_DISABLED";

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export type AccessWritesDisabledReason = "allSites" | "thisSite";

export type AccessWritesState =
  | { disabled: false }
  | { disabled: true; reason: AccessWritesDisabledReason };

type Env = Record<string, string | undefined>;

export function isTruthyFlag(value: string | undefined): boolean {
  return value !== undefined && TRUTHY.has(value.trim().toLowerCase());
}

/** ACCESS_CONTROL_WRITES_DISABLED_SATELLITE for "satellite". */
export function siteWritesDisabledEnvName(siteId: string): string {
  return `${ACCESS_WRITES_DISABLED_ENV}_${siteId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

export function accessWritesState(siteId: string, env: Env = process.env): AccessWritesState {
  if (isTruthyFlag(env[ACCESS_WRITES_DISABLED_ENV])) {
    return { disabled: true, reason: "allSites" };
  }
  if (isTruthyFlag(env[siteWritesDisabledEnvName(siteId)])) {
    return { disabled: true, reason: "thisSite" };
  }
  return { disabled: false };
}

export function writesDisabledMessage(siteName: string): string {
  return `Remote control is switched off in BRAVO for ${siteName}`;
}

/**
 * The name sent to the site bridges and shown in activity. Never an email:
 * first and last name, then the account name if it isn't an address, then
 * "Member".
 */
export function accessActorName(user: {
  firstName?: string;
  lastName?: string;
  name?: string;
}): string {
  const fullName = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(" ");
  if (fullName && !fullName.includes("@")) return fullName;
  const name = user.name?.trim();
  if (name && !name.includes("@")) return name;
  return "Member";
}
