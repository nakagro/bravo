// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { LAUNCH_WINDOW_MS, summarizeLaunches } from "./lib/launches";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const DAY = 24 * 60 * 60 * 1000;

async function setup() {
  const t = convexTest(schema, modules);
  const { adminId, memberId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      firstName: "Alex",
      lastName: "Carter",
      isAdmin: true,
    });
    const memberId = await ctx.db.insert("users", {
      firstName: "Jo",
      lastName: "Adams",
      rank: "Firefighter" as const,
    });
    return { adminId, memberId };
  });
  return {
    t,
    asAdmin: t.withIdentity({ subject: adminId }),
    asMember: t.withIdentity({ subject: memberId }),
    memberId,
  };
}

const phoneBrowser = {
  deviceId: "dev-phone",
  platform: "ios-safari",
  displayMode: "browser" as const,
  deviceClass: "phone" as const,
};

describe("recordLaunch", () => {
  it("upserts one row per device and throttles repeat reports within the hour", async () => {
    const { t, asMember, memberId } = await setup();

    await asMember.mutation(api.userLaunches.recordLaunch, phoneBrowser);
    await asMember.mutation(api.userLaunches.recordLaunch, phoneBrowser);

    const rows = await t.run((ctx) =>
      ctx.db.query("userLaunches").withIndex("by_user", (q) => q.eq("userId", memberId)).collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].launchCount).toBe(1);
  });

  it("records a mode change immediately, even inside the throttle window", async () => {
    const { t, asMember, memberId } = await setup();

    await asMember.mutation(api.userLaunches.recordLaunch, phoneBrowser);
    await asMember.mutation(api.userLaunches.recordLaunch, {
      ...phoneBrowser,
      displayMode: "installed",
    });

    const rows = await t.run((ctx) =>
      ctx.db.query("userLaunches").withIndex("by_user", (q) => q.eq("userId", memberId)).collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].displayMode).toBe("installed");
    expect(rows[0].launchCount).toBe(2);
  });

  it("is a no-op when signed out", async () => {
    const { t } = await setup();
    await t.mutation(api.userLaunches.recordLaunch, phoneBrowser);
    const rows = await t.run((ctx) => ctx.db.query("userLaunches").collect());
    expect(rows).toHaveLength(0);
  });
});

describe("summarizeLaunches", () => {
  const now = Date.now();

  it("counts a member as installed if any phone launch in the window was the app", () => {
    const s = summarizeLaunches(
      [
        { deviceClass: "phone", displayMode: "browser", lastLaunchAt: now - DAY },
        { deviceClass: "phone", displayMode: "installed", lastLaunchAt: now - 5 * DAY },
      ],
      now,
    );
    expect(s.phoneInstall).toBe("installed");
    expect(s.lastInstalledLaunchAt).toBe(now - 5 * DAY);
    expect(s.lastBrowserLaunchAt).toBe(now - DAY);
  });

  it("flags browser-only when every phone launch in the window was a tab", () => {
    const s = summarizeLaunches(
      [
        { deviceClass: "phone", displayMode: "browser", lastLaunchAt: now - DAY },
        // Old install launch, outside the window: no longer counts.
        { deviceClass: "phone", displayMode: "installed", lastLaunchAt: now - LAUNCH_WINDOW_MS - DAY },
      ],
      now,
    );
    expect(s.phoneInstall).toBe("browser-only");
  });

  it("ignores desktop launches entirely", () => {
    const s = summarizeLaunches(
      [{ deviceClass: "desktop", displayMode: "browser", lastLaunchAt: now }],
      now,
    );
    expect(s.phoneInstall).toBe("none");
    expect(s.lastBrowserLaunchAt).toBeUndefined();
  });
});

describe("getMemberActivity phone install", () => {
  it("surfaces browser-only members to admins", async () => {
    const { asAdmin, asMember, memberId } = await setup();
    await asMember.mutation(api.userLaunches.recordLaunch, phoneBrowser);

    const rows = await asAdmin.query(api.authManagement.getMemberActivity, {});
    const member = rows.find((r) => r.userId === memberId);
    expect(member?.phoneInstall).toBe("browser-only");
    expect(member?.lastBrowserLaunchAt).toBeGreaterThan(0);
  });
});
