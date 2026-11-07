// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * Who gets a push: module access first (a Brigade Member without Availability
 * never gets the 10am reminder), then the member's own switches.
 */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("moduleSettings", {
      moduleId: "availability",
      moduleName: "Availability",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      minimumRank: "Probationary",
      updatedAt: Date.now(),
    });
    const adminId = await ctx.db.insert("users", { name: "Admin", rank: "Captain" as const, isAdmin: true });
    const firefighterId = await ctx.db.insert("users", { name: "Ff", rank: "Firefighter" as const });
    const brigadeMemberId = await ctx.db.insert("users", { name: "Bm", rank: "Brigade Member" as const });
    return { adminId, firefighterId, brigadeMemberId };
  });
  return { t, ...ids };
}

describe("pushBlockedUsers", () => {
  it("blocks availability pushes for members without module access", async () => {
    const { t, firefighterId, brigadeMemberId } = await setup();
    const blocked = await t.query(internal.notificationPrefs.pushBlockedUsers, {
      userIds: [firefighterId, brigadeMemberId],
      notificationType: "morningReminder",
    });
    expect(blocked).toEqual([{ userId: brigadeMemberId, reason: "no_module_access" }]);
  });

  it("honours a member muting a category", async () => {
    const { t, firefighterId } = await setup();
    const asFf = t.withIdentity({ subject: firefighterId });
    await asFf.mutation(api.notificationPrefs.setMyNotificationPref, {
      category: "availabilityReminders",
      enabled: false,
    });
    const blocked = await t.query(internal.notificationPrefs.pushBlockedUsers, {
      userIds: [firefighterId],
      notificationType: "nightlyReset",
    });
    expect(blocked).toEqual([{ userId: firefighterId, reason: "muted_by_user" }]);
    // Other categories are untouched
    const rows = await asFf.query(api.notificationPrefs.getMyNotificationPrefs, {});
    expect(rows.find((r) => r.key === "statusChanges")?.enabled).toBe(true);
  });

  it("never filters uncategorised types such as tests", async () => {
    const { t, brigadeMemberId } = await setup();
    const blocked = await t.query(internal.notificationPrefs.pushBlockedUsers, {
      userIds: [brigadeMemberId],
      notificationType: "test",
    });
    expect(blocked).toEqual([]);
  });
});

describe("admin notification prefs", () => {
  it("lets an admin view and change a member's prefs, and refuses non-admins", async () => {
    const { t, adminId, firefighterId, brigadeMemberId } = await setup();
    const asAdmin = t.withIdentity({ subject: adminId });
    await asAdmin.mutation(api.notificationPrefs.setUserNotificationPref, {
      userId: firefighterId,
      category: "availabilityReminders",
      enabled: false,
    });
    const rows = await asAdmin.query(api.notificationPrefs.getUserNotificationPrefs, { userId: firefighterId });
    expect(rows.find((r) => r.key === "availabilityReminders")?.enabled).toBe(false);

    const bmRows = await asAdmin.query(api.notificationPrefs.getUserNotificationPrefs, { userId: brigadeMemberId });
    expect(bmRows.find((r) => r.key === "availabilityReminders")?.available).toBe(false);

    await expect(
      t.withIdentity({ subject: firefighterId }).query(api.notificationPrefs.getUserNotificationPrefs, {
        userId: brigadeMemberId,
      }),
    ).rejects.toThrow(/administrators/);
  });
});
