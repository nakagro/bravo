/**
 * Frontend mirror of `convex/lib/accountType.ts`. Hand-mirrored rather than
 * imported across the boundary — see the note at
 * `src/features/memberRecords/types.ts:3`.
 */
export type AccountType = "member" | "shared";

/** A login that isn't a person: the Duty Officer phone, an appliance tablet. */
export function isSharedAccount(user: { accountType?: string | null } | null | undefined): boolean {
  return user?.accountType === "shared";
}
