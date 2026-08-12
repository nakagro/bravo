// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * Last seen is derived from the auth tables, so these pin down the derivation:
 * a refresh token minted while the app was open beats the sign-in timestamp,
 * and no session at all means no evidence rather than a zero.
 */
const HOUR = 60 * 60 * 1000;

async function setup() {
  const t = convexTest(schema, modules);

  const { adminId, activeId, lapsedId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      firstName: "Max",
      lastName: "Carter",
      isAdmin: true,
    });
    const activeId = await ctx.db.insert("users", {
      firstName: "Jo",
      lastName: "Adams",
      rank: "Firefighter" as const,
    });
    const lapsedId = await ctx.db.insert("users", {
      firstName: "Sam",
      lastName: "Zhu",
      rank: "Firefighter" as const,
    });
    return { adminId, activeId, lapsedId };
  });

  return { t, asAdmin: t.withIdentity({ subject: adminId }), adminId, activeId, lapsedId };
}

describe("getMemberActivity", () => {
  it("reports a live session and counts devices, and no session as unseen", async () => {
    const { t, asAdmin, activeId, lapsedId } = await setup();

    await t.run(async (ctx) => {
      for (const _device of [1, 2]) {
        await ctx.db.insert("authSessions", {
          userId: activeId,
          expirationTime: Date.now() + HOUR,
        });
      }
    });

    const rows = await asAdmin.query(api.authManagement.getMemberActivity, {});
    const active = rows.find((r) => r.userId === activeId);
    const lapsed = rows.find((r) => r.userId === lapsedId);

    expect(active?.deviceCount).toBe(2);
    expect(active?.lastSeenAt).toBeGreaterThan(0);
    // Nobody signed out is not the same as nobody ever used it - both read as
    // "no live session", which the UI says in those words.
    expect(lapsed?.lastSeenAt).toBeUndefined();
    expect(lapsed?.deviceCount).toBe(0);
  });

  it("prefers the newest refresh token over the sign-in time", async () => {
    const { t, asAdmin, activeId } = await setup();

    const refreshedAt = await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("authSessions", {
        userId: activeId,
        expirationTime: Date.now() + HOUR,
      });
      const tokenId = await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + HOUR,
      });
      return (await ctx.db.get(tokenId))!._creationTime;
    });

    const rows = await asAdmin.query(api.authManagement.getMemberActivity, {});
    expect(rows.find((r) => r.userId === activeId)?.lastSeenAt).toBe(refreshedAt);
  });

  it("reports the last availability change even with no live session", async () => {
    const { t, asAdmin, lapsedId } = await setup();

    const setAt = Date.now() - 3 * HOUR;
    await t.run(async (ctx) => {
      await ctx.db.insert("memberStatusHistory", {
        userId: lapsedId,
        status: "not available" as const,
        timestamp: setAt,
      });
    });

    const rows = await asAdmin.query(api.authManagement.getMemberActivity, {});
    const lapsed = rows.find((r) => r.userId === lapsedId);
    // The nightly reset wipes users.statusUpdatedAt, so the history table is
    // the only durable answer to "when did they last tell us anything".
    expect(lapsed?.lastStatusChangeAt).toBe(setAt);
    expect(lapsed?.lastSeenAt).toBeUndefined();
  });

  it("is admin only", async () => {
    const { t, activeId } = await setup();

    await expect(
      t.withIdentity({ subject: activeId }).query(api.authManagement.getMemberActivity, {}),
    ).rejects.toThrow(/administrators/);
  });
});

describe("getUserStatusHistory", () => {
  it("returns the newest changes first, capped at the limit", async () => {
    const { t, asAdmin, activeId } = await setup();

    const now = Date.now();
    await t.run(async (ctx) => {
      for (let i = 0; i < 12; i++) {
        await ctx.db.insert("memberStatusHistory", {
          userId: activeId,
          status: i % 2 === 0 ? ("available - station" as const) : ("not available" as const),
          timestamp: now - i * HOUR,
        });
      }
    });

    const entries = await asAdmin.query(api.authManagement.getUserStatusHistory, {
      userId: activeId,
    });

    expect(entries).toHaveLength(10);
    expect(entries[0].timestamp).toBe(now);
    expect(entries[0].status).toBe("available - station");
  });

  it("is admin only", async () => {
    const { t, activeId } = await setup();

    await expect(
      t.withIdentity({ subject: activeId }).query(api.authManagement.getUserStatusHistory, {
        userId: activeId,
      }),
    ).rejects.toThrow(/administrators/);
  });
});
