// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * Retiring someone who has left the brigade. Disabling is the reversible path
 * (row and history stay, login and lists go); deleting is the narrow one for a
 * mistaken signup. Both are admin-only and refuse the actor's own account.
 */
async function setup() {
  const t = convexTest(schema, modules);

  const { adminId, memberId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Alex Carter",
      firstName: "Max",
      lastName: "Carter",
      rank: "Captain" as const,
      isAdmin: true,
    });
    const memberId = await ctx.db.insert("users", {
      name: "Jo Adams",
      firstName: "Jo",
      lastName: "Adams",
      rank: "Firefighter" as const,
    });
    return { adminId, memberId };
  });

  return { t, asAdmin: t.withIdentity({ subject: adminId }), adminId, memberId };
}

describe("setUserDisabled", () => {
  it("drops the member from member lists and revokes their sessions", async () => {
    const { t, asAdmin, memberId } = await setup();

    const sessionId = await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("authSessions", {
        userId: memberId,
        expirationTime: Date.now() + 1000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + 1000,
      });
      await ctx.db.insert("pushSubscriptions", {
        userId: memberId,
        subscription: {},
        createdAt: Date.now(),
      });
      return sessionId;
    });

    expect((await asAdmin.query(api.users.getMemberUsers, {})).map((u) => u._id))
      .toContain(memberId);

    await asAdmin.mutation(api.users.setUserDisabled, { userId: memberId, isDisabled: true });

    expect((await asAdmin.query(api.users.getMemberUsers, {})).map((u) => u._id))
      .not.toContain(memberId);

    await t.run(async (ctx) => {
      // The row survives, so historical references still resolve to a name.
      const member = await ctx.db.get(memberId);
      expect(member?.isDisabled).toBe(true);
      expect(member?.firstName).toBe("Jo");
      expect(await ctx.db.get(sessionId)).toBeNull();
      expect(await ctx.db.query("authRefreshTokens").collect()).toHaveLength(0);
      expect(await ctx.db.query("pushSubscriptions").collect()).toHaveLength(0);
    });
  });

  it("re-enables without touching rank or roles", async () => {
    const { t, asAdmin, memberId } = await setup();

    await asAdmin.mutation(api.users.setUserDisabled, { userId: memberId, isDisabled: true });
    await asAdmin.mutation(api.users.setUserDisabled, { userId: memberId, isDisabled: false });

    expect((await asAdmin.query(api.users.getMemberUsers, {})).map((u) => u._id))
      .toContain(memberId);
    await t.run(async (ctx) => {
      const member = await ctx.db.get(memberId);
      expect(member?.rank).toBe("Firefighter");
      expect(member?.disabledAt).toBeUndefined();
    });
  });

  it("refuses non-admins and self-disabling", async () => {
    const { t, asAdmin, adminId, memberId } = await setup();

    await expect(
      t.withIdentity({ subject: memberId }).mutation(api.users.setUserDisabled, {
        userId: adminId,
        isDisabled: true,
      }),
    ).rejects.toThrow(/administrators/);

    await expect(
      asAdmin.mutation(api.users.setUserDisabled, { userId: adminId, isDisabled: true }),
    ).rejects.toThrow(/your own account/);
  });
});

describe("deleteUser", () => {
  it("removes the row and its auth account, freeing the email", async () => {
    const { t, asAdmin, memberId } = await setup();

    await t.run(async (ctx) => {
      await ctx.db.insert("authAccounts", {
        userId: memberId,
        provider: "password",
        providerAccountId: "jo@example.com",
        secret: "hash",
      });
    });

    await asAdmin.mutation(api.users.deleteUser, { userId: memberId });

    await t.run(async (ctx) => {
      expect(await ctx.db.get(memberId)).toBeNull();
      expect(await ctx.db.query("authAccounts").collect()).toHaveLength(0);
    });
  });

  it("refuses non-admins", async () => {
    const { t, adminId, memberId } = await setup();

    await expect(
      t.withIdentity({ subject: memberId }).mutation(api.users.deleteUser, { userId: adminId }),
    ).rejects.toThrow(/administrators/);
  });
});
