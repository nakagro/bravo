// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const KEY = "dutyCrew:checksSubmitted";

async function setup() {
  const t = convexTest(schema, modules);

  const { adminId, otherId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Admin officer",
      firstName: "Admin",
      lastName: "Officer",
      email: "admin@example.com",
      isAdmin: true,
    });
    const otherId = await ctx.db.insert("users", {
      name: "Other officer",
      firstName: "Other",
      lastName: "Officer",
      email: "other@example.com",
      rank: "Lieutenant" as const,
    });

    await ctx.db.insert("moduleSettings", {
      moduleId: "dutyCrew",
      moduleName: "Duty Crew",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      updatedAt: Date.now(),
    });

    return { adminId, otherId };
  });

  return {
    t,
    adminId,
    otherId,
    asAdmin: t.withIdentity({ subject: adminId }),
    asOther: t.withIdentity({ subject: otherId }),
  };
}

const map = (
  t: ReturnType<typeof convexTest>,
  userIds: Id<"users">[],
  overrides: Partial<{
    isEnabled: boolean;
    notifyInApp: boolean;
    notifyEmail: boolean;
  }> = {}
) =>
  t.run(async (ctx) => {
    await ctx.db.insert("actionAccountability", {
      conditionKey: KEY,
      roles: [],
      userIds,
      isEnabled: overrides.isEnabled ?? true,
      notifyInApp: overrides.notifyInApp ?? true,
      notifyEmail: overrides.notifyEmail ?? false,
    });
  });

const sendTest = (
  asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>
) =>
  asUser.mutation(api.actionAccountability.sendTestNotification, {
    conditionKey: KEY,
    moduleId: "dutyCrew",
    title: "Weekly station checks submitted",
    url: "/dutycrew?tab=history",
  });

describe("sendTestNotification", () => {
  it("notifies the caller even though they are the actor", async () => {
    const { t, otherId, asAdmin } = await setup();
    // Mapped to someone else entirely - the test still reaches the tester.
    await map(t, [otherId]);

    const result = await sendTest(asAdmin);
    expect(result.inApp).toBe(true);

    const actions = await asAdmin.query(api.actionCentre.getMyActions, {});
    const notice = actions.find((a) => a.kind === "notice");
    expect(notice).toBeDefined();
    expect(notice!.title).toBe("[TEST] Weekly station checks submitted");
  });

  it("does not reach the real audience", async () => {
    const { t, otherId, asAdmin, asOther } = await setup();
    await map(t, [otherId]);

    await sendTest(asAdmin);

    const actions = await asOther.query(api.actionCentre.getMyActions, {});
    expect(actions.find((a) => a.kind === "notice")).toBeUndefined();
  });

  it("replaces the previous test rather than stacking them up", async () => {
    const { t, adminId, asAdmin } = await setup();
    await map(t, [adminId]);

    await sendTest(asAdmin);
    await sendTest(asAdmin);

    const notices = await t.run((ctx) => ctx.db.query("actionNotices").take(10));
    expect(notices).toHaveLength(1);
  });

  it("reports the address when email delivery is on", async () => {
    const { t, adminId, asAdmin } = await setup();
    await map(t, [adminId], { notifyEmail: true });

    const result = await sendTest(asAdmin);
    expect(result.emailedTo).toBe("admin@example.com");
  });

  it("reports no address when email delivery is off", async () => {
    const { t, adminId, asAdmin } = await setup();
    await map(t, [adminId], { notifyEmail: false });

    const result = await sendTest(asAdmin);
    expect(result.emailedTo).toBeNull();
  });

  it("refuses while the notification is switched off", async () => {
    const { t, adminId, asAdmin } = await setup();
    await map(t, [adminId], { isEnabled: false });

    await expect(sendTest(asAdmin)).rejects.toThrow("Turn these notifications on");
  });

  it("refuses when the key has never been configured", async () => {
    const { asAdmin } = await setup();

    await expect(sendTest(asAdmin)).rejects.toThrow("Turn these notifications on");
  });

  it("refuses when no delivery method is selected", async () => {
    const { t, adminId, asAdmin } = await setup();
    await map(t, [adminId], { notifyInApp: false, notifyEmail: false });

    await expect(sendTest(asAdmin)).rejects.toThrow("Pick at least one delivery method");
  });

  it("refuses a non-admin", async () => {
    const { t, adminId, asOther } = await setup();
    await map(t, [adminId]);

    await expect(sendTest(asOther)).rejects.toThrow(
      "You do not have access to manage notifications"
    );
  });
});
