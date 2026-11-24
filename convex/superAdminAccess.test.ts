// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { openModules } from "./moduleFixtures.testing";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await openModules(ctx);
    await ctx.db.insert("moduleSettings", {
      moduleId: "accessControl",
      moduleName: "Access Control",
      isEnabled: true,
      adminOnly: false,
      superAdminOnly: true,
      requiredRoles: [],
      minimumRank: "Lieutenant",
      updatedAt: Date.now(),
    });
  });

  const ids = await t.run(async (ctx) => {
    const superAdmin = await ctx.db.insert("users", {
      firstName: "Morgan",
      lastName: "Shaw",
      email: "morgan@example.com",
      rank: "Captain",
      isAdmin: true,
      isSuperAdmin: true,
    });
    const admin = await ctx.db.insert("users", {
      firstName: "Alex",
      lastName: "Carter",
      email: "alex@example.com",
      rank: "Captain",
      isAdmin: true,
    });
    const member = await ctx.db.insert("users", {
      firstName: "Sam",
      lastName: "Taylor",
      email: "sam@example.com",
      rank: "Firefighter",
    });
    const disabledMember = await ctx.db.insert("users", {
      firstName: "Casey",
      lastName: "Morgan",
      email: "casey@example.com",
      rank: "Captain",
      isDisabled: true,
    });
    return { superAdmin, admin, member, disabledMember };
  });

  return {
    t,
    ids,
    asSuperAdmin: t.withIdentity({ subject: ids.superAdmin }),
    asAdmin: t.withIdentity({ subject: ids.admin }),
    asMember: t.withIdentity({ subject: ids.member }),
    asDisabled: t.withIdentity({ subject: ids.disabledMember }),
  };
}

describe("superAdminOnly modules and individual allowedUserIds", () => {
  it("locks regular admins and members out of superAdminOnly modules while super admins retain access", async () => {
    const { asSuperAdmin, asAdmin, asMember } = await setup();

    const superAccess = await asSuperAdmin.query(api.modules.getAllModuleAccess, {});
    const adminAccess = await asAdmin.query(api.modules.getAllModuleAccess, {});
    const memberAccess = await asMember.query(api.modules.getAllModuleAccess, {});

    expect(superAccess.accessControl).toBe(true);
    expect(adminAccess.accessControl).toBe(false);
    expect(memberAccess.accessControl).toBe(false);

    // Regular admins still access normal modules like admin and hoses.
    expect(adminAccess.hoses).toBe(true);
    expect(adminAccess.admin).toBe(true);

    expect(await asSuperAdmin.query(api.modules.checkModuleAccess, { moduleId: "accessControl" })).toBe(true);
    expect(await asAdmin.query(api.modules.checkModuleAccess, { moduleId: "accessControl" })).toBe(false);
    expect(await asMember.query(api.modules.checkModuleAccess, { moduleId: "accessControl" })).toBe(false);
  });

  it("hides superAdminOnly modules from regular admins in getModuleSettings and blocks mutations", async () => {
    const { asSuperAdmin, asAdmin } = await setup();

    const superList = await asSuperAdmin.query(api.modules.getModuleSettings, {});
    const adminList = await asAdmin.query(api.modules.getModuleSettings, {});
    expect(superList.some((m) => m.moduleId === "accessControl")).toBe(true);
    expect(adminList.some((m) => m.moduleId === "accessControl")).toBe(false);

    await expect(
      asAdmin.mutation(api.modules.updateModuleStatus, { moduleId: "accessControl", isEnabled: false }),
    ).rejects.toThrow(/super administrators/i);
    await expect(
      asAdmin.mutation(api.modules.updateModuleRequirements, {
        moduleId: "accessControl",
        adminOnly: false,
        superAdminOnly: false,
        requiredRoles: [],
      }),
    ).rejects.toThrow(/super administrators/i);
    await expect(
      asAdmin.mutation(api.modules.updateModuleRequirements, {
        moduleId: "hoses",
        adminOnly: false,
        superAdminOnly: true,
        requiredRoles: [],
      }),
    ).rejects.toThrow(/super administrators/i);
  });

  it("grants single users access via allowedUserIds regardless of rank or admin status when enabled", async () => {
    const { asSuperAdmin, asAdmin, asMember, asDisabled, ids } = await setup();

    // Super admin adds a Firefighter, a regular admin, and a disabled member to allowedUserIds.
    await asSuperAdmin.mutation(api.modules.updateModuleRequirements, {
      moduleId: "accessControl",
      adminOnly: false,
      superAdminOnly: true,
      allowedUserIds: [ids.member, ids.admin, ids.disabledMember],
      requiredRoles: [],
      minimumRank: "Lieutenant",
    });

    expect((await asMember.query(api.modules.getAllModuleAccess, {})).accessControl).toBe(true);
    expect((await asAdmin.query(api.modules.getAllModuleAccess, {})).accessControl).toBe(true);
    // Disabled accounts never gain access, even if listed.
    expect((await asDisabled.query(api.modules.getAllModuleAccess, {})).accessControl).toBe(false);

    // Disabling the module revokes access for allowlisted non-super-admins.
    await asSuperAdmin.mutation(api.modules.updateModuleStatus, {
      moduleId: "accessControl",
      isEnabled: false,
    });
    expect((await asMember.query(api.modules.getAllModuleAccess, {})).accessControl).toBe(false);
    expect((await asAdmin.query(api.modules.getAllModuleAccess, {})).accessControl).toBe(false);
    expect((await asSuperAdmin.query(api.modules.getAllModuleAccess, {})).accessControl).toBe(true);
  });

  it("protects super admin accounts from regular admins and supports CLI bootstrap helpers", async () => {
    const { t, asSuperAdmin, asAdmin, ids } = await setup();

    await expect(
      asAdmin.mutation(api.users.updateUserSuperAdminStatus, { userId: ids.member, isSuperAdmin: true }),
    ).rejects.toThrow(/super administrators/i);
    await expect(
      asAdmin.mutation(api.users.updateUserAdminStatus, { userId: ids.superAdmin, isAdmin: false }),
    ).rejects.toThrow(/super administrators/i);
    await expect(
      asAdmin.mutation(api.users.setUserDisabled, { userId: ids.superAdmin, isDisabled: true }),
    ).rejects.toThrow(/super administrators/i);
    await expect(
      asAdmin.mutation(api.users.deleteUser, { userId: ids.superAdmin }),
    ).rejects.toThrow(/super administrators/i);

    // Super admin cannot change their own super admin status.
    await expect(
      asSuperAdmin.mutation(api.users.updateUserSuperAdminStatus, {
        userId: ids.superAdmin,
        isSuperAdmin: false,
      }),
    ).rejects.toThrow(/your own super admin status/i);

    // Super admin can promote another user, which also sets isAdmin: true.
    await asSuperAdmin.mutation(api.users.updateUserSuperAdminStatus, {
      userId: ids.member,
      isSuperAdmin: true,
    });
    const promoted = await t.run((ctx) => ctx.db.get(ids.member));
    expect(promoted).toMatchObject({ isSuperAdmin: true, isAdmin: true });

    // Cannot strip isAdmin while isSuperAdmin is still true.
    await expect(
      asSuperAdmin.mutation(api.users.updateUserAdminStatus, { userId: ids.member, isAdmin: false }),
    ).rejects.toThrow(/Remove super admin status/i);

    // Internal CLI helper sets super admin by email and locks modules.
    await t.mutation(internal.users.setSuperAdmin, {
      email: "alex@example.com",
      isSuperAdmin: true,
    });
    const alex = await t.run((ctx) => ctx.db.get(ids.admin));
    expect(alex).toMatchObject({ isSuperAdmin: true, isAdmin: true });

    await t.mutation(internal.modules.setModuleSuperAdminOnlyInternal, {
      moduleId: "hoses",
      superAdminOnly: true,
    });
    const hoses = await t.run((ctx) =>
      ctx.db
        .query("moduleSettings")
        .withIndex("by_moduleId", (q) => q.eq("moduleId", "hoses"))
        .first(),
    );
    expect(hoses?.superAdminOnly).toBe(true);
  });
});
