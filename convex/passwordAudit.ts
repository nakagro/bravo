import { v } from "convex/values";
import { Scrypt } from "lucia";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Passwords members should change. The old sign-up form set every new
 * member's password to their CFA number, which isn't secret. This finds those
 * accounts by checking each stored hash against the member's own CFA number,
 * the same check a sign-in makes, and flags them; the Action Centre then asks
 * them to change it until they do.
 *
 * The check reads hashes directly rather than going through sign-in, so it
 * doesn't count as a failed attempt against anyone.
 */

const reasonValidator = v.union(v.literal("cfaNumber"), v.literal("temporary"));

/** Internal only: password hashes never leave the server. */
export const passwordAccounts = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      userId: v.id("users"),
      hash: v.string(),
      memberNumber: v.optional(v.string()),
      reason: v.optional(reasonValidator),
    }),
  ),
  handler: async (ctx) => {
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "password"))
      .collect();
    const out = [];
    for (const account of accounts) {
      if (!account.secret) continue;
      const user = await ctx.db.get(account.userId);
      if (!user || user.isDisabled) continue;
      out.push({
        userId: user._id,
        hash: account.secret,
        memberNumber: user.memberNumber,
        reason: user.passwordChangeReason,
      });
    }
    return out;
  },
});

export const setPasswordChangeReason = internalMutation({
  args: { userId: v.id("users"), reason: v.optional(reasonValidator) },
  returns: v.null(),
  handler: async (ctx, { userId, reason }) => {
    const user = await ctx.db.get(userId);
    if (!user || user.passwordChangeReason === reason) return null;
    await ctx.db.patch(userId, { passwordChangeReason: reason });
    return null;
  },
});

type PasswordAccount = {
  userId: Id<"users">;
  hash: string;
  memberNumber?: string;
  reason?: "cfaNumber" | "temporary";
};

async function audit(ctx: ActionCtx): Promise<{ checked: number; flagged: number }> {
  const accounts: PasswordAccount[] = await ctx.runQuery(
    internal.passwordAudit.passwordAccounts,
    {},
  );
  const scrypt = new Scrypt();
  let flagged = 0;
  for (const account of accounts) {
    // A temporary password an admin set stays flagged until it's changed.
    if (account.reason === "temporary") continue;
    const number = account.memberNumber?.trim();
    const isCfaNumber = !!number && (await scrypt.verify(account.hash, number));
    if (isCfaNumber) flagged++;
    const reason = isCfaNumber ? ("cfaNumber" as const) : undefined;
    if (reason !== account.reason) {
      await ctx.runMutation(internal.passwordAudit.setPasswordChangeReason, {
        userId: account.userId,
        reason,
      });
    }
  }
  return { checked: accounts.length, flagged };
}

const auditResult = v.object({ checked: v.number(), flagged: v.number() });

/** Run after deploying, or from the dashboard: `passwordAudit:auditPasswords`. */
export const auditPasswords = internalAction({
  args: {},
  returns: auditResult,
  handler: async (ctx): Promise<{ checked: number; flagged: number }> => await audit(ctx),
});

/** The same check from Admin Tasks. Returns counts only. */
export const runPasswordAudit = action({
  args: {},
  returns: auditResult,
  handler: async (ctx): Promise<{ checked: number; flagged: number }> => {
    await ctx.runQuery(internal.access.assertAdmin, {});
    return await audit(ctx);
  },
});
