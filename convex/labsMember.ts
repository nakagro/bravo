import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { isMemberAccount } from "./lib/accountType";

/**
 * Backs POST /labs/member. Labs holds its own 30-day session and asks here
 * whether the person is still a Labs member, so revocation doesn't wait for the
 * session to expire. Same predicate as the JWT's `labsMember` claim
 * (auth.ts jwt.customClaims); an unknown, malformed or deleted id is simply
 * "not a member" so the endpoint never reveals whether an id exists.
 */
export const isLabsMember = internalQuery({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const id = ctx.db.normalizeId("users", userId);
    if (!id) return false;
    const user = await ctx.db.get(id);
    return isMemberAccount(user ?? {});
  },
});

/**
 * Constant-time secret check. Both sides are hashed first so the comparison
 * runs over equal-length digests and leaks neither content nor length.
 * An unset or empty expected secret rejects everything.
 */
export async function secretMatches(
  presented: string | null,
  expected: string | undefined,
): Promise<boolean> {
  if (!expected || presented === null) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(presented)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
