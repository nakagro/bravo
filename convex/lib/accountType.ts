import { v } from "convex/values";
import type { Infer } from "convex/values";

/**
 * What kind of login a `users` row is. Absent means "member" - the brigade's
 * people - so existing rows keep their behaviour with no backfill.
 */
export const accountTypeValidator = v.union(v.literal("member"), v.literal("shared"));

export type AccountType = Infer<typeof accountTypeValidator>;

/** A login that isn't a person: the Duty Officer phone, an appliance tablet. */
export function isSharedAccount(user: { accountType?: string | null }): boolean {
  return user.accountType === "shared";
}

/**
 * Who counts as a brigade member for member-facing lists. Folds in the
 * "not a bare auth row" check that memberKit.ts, baRecords.ts and http.ts each
 * spelled out separately.
 */
export function isMemberAccount(user: {
  accountType?: string | null;
  isAnonymous?: boolean;
  firstName?: string;
  lastName?: string;
  name?: string;
}): boolean {
  if (isSharedAccount(user)) return false;
  return !user.isAnonymous && !!(user.firstName || user.lastName || user.name);
}
