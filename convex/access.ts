import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requireAdmin, requireModule, requireOfficer, requireUser } from "./lib/access";

/**
 * Actions have no `ctx.db`, so they check the caller through these. The
 * caller's auth identity carries into `ctx.runQuery`, so the check is on the
 * person who called the action. Each throws on denial and returns the user id.
 */

export const assertUser = internalQuery({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => (await requireUser(ctx))._id,
});

export const assertAdmin = internalQuery({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => (await requireAdmin(ctx))._id,
});

export const assertOfficer = internalQuery({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => (await requireOfficer(ctx))._id,
});

export const assertModule = internalQuery({
  args: { moduleIds: v.array(v.string()) },
  returns: v.id("users"),
  handler: async (ctx, { moduleIds }) => (await requireModule(ctx, moduleIds))._id,
});

/** The active caller's own email and display name, for self-addressed mail. */
export const callerContact = internalQuery({
  args: {},
  returns: v.object({ email: v.union(v.string(), v.null()), name: v.string() }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || "";
    return { email: user.email ?? null, name };
  },
});
