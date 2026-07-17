// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("calendar module permissions", () => {
  it("adds separate read and write settings during module sync", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.modules.syncModuleSettings, {});
    const settings = await t.query(api.modules.getModuleSettings, {});

    const readSetting = settings.find(
      (setting) => setting.moduleId === "calendar",
    );
    expect(readSetting).toMatchObject({
      moduleName: "Calendar (Read)",
      isEnabled: true,
    });
    expect(readSetting?.minimumRank).toBeUndefined();
    expect(
      settings.find((setting) => setting.moduleId === "calendarWrite"),
    ).toMatchObject({
      moduleName: "Calendar (Write)",
      isEnabled: true,
      minimumRank: "Lieutenant",
    });
  });

  it("evaluates read and write access independently", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Calendar member",
        rank: "Firefighter",
        roles: ["Calendar Reader"],
      });
      const timestamp = Date.now();
      await ctx.db.insert("moduleSettings", {
        moduleId: "calendar",
        moduleName: "Calendar (Read)",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: ["Calendar Reader"],
        updatedAt: timestamp,
      });
      await ctx.db.insert("moduleSettings", {
        moduleId: "calendarWrite",
        moduleName: "Calendar (Write)",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
        updatedAt: timestamp,
      });
      return userId;
    });

    const asMember = t.withIdentity({ subject: userId });
    const access = await asMember.query(api.modules.getAllModuleAccess, {});

    expect(access.calendar).toBe(true);
    expect(access.calendarWrite).toBe(false);
    expect(
      await asMember.query(api.calendarWrite.canWriteCalendar, {}),
    ).toBe(false);

    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { rank: "Lieutenant" });
    });

    expect(
      await asMember.query(api.calendarWrite.canWriteCalendar, {}),
    ).toBe(true);
  });

  it("denies disabled calendar read access while admins retain access", async () => {
    const t = convexTest(schema, modules);
    const { memberId, adminId } = await t.run(async (ctx) => {
      const memberId = await ctx.db.insert("users", { name: "Member" });
      const adminId = await ctx.db.insert("users", {
        name: "Admin",
        isAdmin: true,
      });
      await ctx.db.insert("moduleSettings", {
        moduleId: "calendar",
        moduleName: "Calendar (Read)",
        isEnabled: false,
        adminOnly: false,
        requiredRoles: [],
        updatedAt: Date.now(),
      });
      return { memberId, adminId };
    });

    const memberAccess = await t
      .withIdentity({ subject: memberId })
      .query(api.modules.getAllModuleAccess, {});
    const adminAccess = await t
      .withIdentity({ subject: adminId })
      .query(api.modules.getAllModuleAccess, {});

    expect(memberAccess.calendar).toBe(false);
    expect(adminAccess.calendar).toBe(true);
  });
});
