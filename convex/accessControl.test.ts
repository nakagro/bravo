// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { openModules } from "./moduleFixtures.testing";

// The holes from the Nov 2026 security sweep, each tried as an outsider, a
// pending sign-up, a member and an admin. See docs/plans/convex-security-sweep-2026-11.md.

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.run((ctx) => openModules(ctx));
  const ids = await t.run(async (ctx) => {
    const member = await ctx.db.insert("users", {
      name: "Sam Nurse",
      firstName: "Sam",
      lastName: "Nurse",
      email: "sam@example.com",
      memberNumber: "1000001",
      rank: "Firefighter",
    });
    const captain = await ctx.db.insert("users", {
      name: "Jo Adams",
      firstName: "Jo",
      lastName: "Adams",
      email: "jo@example.com",
      memberNumber: "1000002",
      rank: "Captain",
    });
    const lieutenant = await ctx.db.insert("users", {
      name: "Riley Brooks",
      firstName: "Riley",
      lastName: "Brooks",
      rank: "Lieutenant",
    });
    const admin = await ctx.db.insert("users", {
      name: "Alex Carter",
      firstName: "Alex",
      lastName: "Carter",
      email: "alex@example.com",
      isAdmin: true,
    });
    const pending = await ctx.db.insert("users", {
      name: "Casey Stranger",
      firstName: "Casey",
      lastName: "Stranger",
      email: "casey@example.com",
      rank: "Brigade Member",
      approvalStatus: "pending",
    });
    const disabledAdmin = await ctx.db.insert("users", {
      name: "Former Admin",
      firstName: "Former",
      lastName: "Admin",
      isAdmin: true,
      isDisabled: true,
    });
    return { member, captain, lieutenant, admin, pending, disabledAdmin };
  });
  return {
    t,
    ...ids,
    asMember: t.withIdentity({ subject: ids.member }),
    asLieutenant: t.withIdentity({ subject: ids.lieutenant }),
    asAdmin: t.withIdentity({ subject: ids.admin }),
    asPending: t.withIdentity({ subject: ids.pending }),
    asDisabledAdmin: t.withIdentity({ subject: ids.disabledAdmin }),
  };
}

describe("signed-out callers", () => {
  it("get no member data", async () => {
    const { t } = await setup();
    expect(await t.query(api.users.getUsers, {})).toEqual([]);
    expect(await t.query(api.users.getMemberUsers, {})).toEqual([]);
    expect(await t.query(api.availability.getAllUsersStatus, {})).toEqual([]);
    expect(await t.query(api.availability.getDutyOfficer, {})).toBeNull();
    expect(await t.query(api.skills.getBatchUserSkills, { userIds: [] })).toEqual({});
    expect(await t.query(api.vehicleFaults.getVehicleFaults, {})).toEqual([]);
    expect(await t.query(api.messages.getMessages, {})).toEqual([]);
  });

  it("can't run admin jobs, push, or change config", async () => {
    const { t, member } = await setup();
    await expect(t.mutation(api.modules.updateModuleStatus, { moduleId: "hoses", isEnabled: false })).rejects.toThrow(/signed in/);
    await expect(t.mutation(api.modules.syncModuleSettings, {})).rejects.toThrow(/signed in/);
    await expect(t.mutation(api.availability.processStatusTransitions, {})).rejects.toThrow(/signed in/);
    await expect(t.action(api.availabilityActions.nightlyReset, {})).rejects.toThrow(/signed in/);
    await expect(t.action(api.messages.deleteAllMessagesAction, {})).rejects.toThrow(/signed in/);
    await expect(t.mutation(api.users.createRole, { name: "Boss" })).rejects.toThrow(/signed in/);
    await expect(t.mutation(api.skills.createSkill, { name: "X", code: "X" })).rejects.toThrow(/signed in/);
    await expect(
      t.action(api.pushNotificationAction.sendNotification, { title: "hi", body: "hi", userId: member }),
    ).rejects.toThrow();
    await expect(t.query(api.authManagement.searchUsers, { searchTerm: "sam" })).rejects.toThrow(/signed in/);
  });

  it("can't rename or re-rank a member through the sign-up fallback", async () => {
    const { t, captain } = await setup();
    const result = await t.mutation(api.auth.storeSignupData, {
      email: "jo@example.com",
      firstName: "Hacked",
      lastName: "Name",
      memberNumber: "9999999",
    });
    expect(result.success).toBe(false);
    const jo = await t.run((ctx) => ctx.db.get(captain));
    expect(jo).toMatchObject({ firstName: "Jo", rank: "Captain", memberNumber: "1000002" });
  });
});

describe("a pending sign-up", () => {
  it("reaches nothing until approved", async () => {
    const { asPending } = await setup();
    expect(await asPending.query(api.users.getMemberUsers, {})).toEqual([]);
    expect(await asPending.query(api.availability.getAllUsersStatus, {})).toEqual([]);
    const access = await asPending.query(api.modules.getAllModuleAccess, {});
    expect(Object.values(access).some(Boolean)).toBe(false);
    await expect(
      asPending.mutation(api.availability.updateUserStatus, { status: "not available" }),
    ).rejects.toThrow(/waiting for an administrator/);
  });

  it("is left off member lists", async () => {
    const { asMember, pending } = await setup();
    const members = await asMember.query(api.users.getMemberUsers, {});
    expect(members.map((m) => m._id)).not.toContain(pending);
  });

  it("can only update its own sign-up details", async () => {
    const { t, asPending, pending, captain } = await setup();
    await expect(
      asPending.mutation(api.auth.storeSignupData, {
        email: "jo@example.com",
        firstName: "Hacked",
        lastName: "Name",
        memberNumber: "9999999",
      }),
    ).rejects.toThrow(/your own account/);
    await asPending.mutation(api.auth.storeSignupData, {
      email: "casey@example.com",
      firstName: "Casey",
      lastName: "Stranger",
      memberNumber: "1000009",
    });
    const [casey, jo] = await t.run(async (ctx) => [await ctx.db.get(pending), await ctx.db.get(captain)]);
    expect(casey?.memberNumber).toBe("1000009");
    expect(jo?.firstName).toBe("Jo");
  });

  it("is approved by an admin, and only an admin", async () => {
    const { t, asMember, asAdmin, pending, admin } = await setup();
    expect(await asMember.query(api.users.listPendingUsers, {})).toEqual([]);
    await expect(asMember.mutation(api.users.approveUser, { userId: pending })).rejects.toThrow(
      /Only administrators/,
    );

    const list = await asAdmin.query(api.users.listPendingUsers, {});
    expect(list.map((u) => u._id)).toEqual([pending]);

    await asAdmin.mutation(api.users.approveUser, { userId: pending });
    const casey = await t.run((ctx) => ctx.db.get(pending));
    expect(casey).toMatchObject({ approvalStatus: "approved", approvedBy: admin });
    expect(await asAdmin.query(api.users.listPendingUsers, {})).toEqual([]);
  });
});

describe("a signed-in member", () => {
  it("can't change module permissions", async () => {
    const { asMember } = await setup();
    await expect(
      asMember.mutation(api.modules.updateModuleRequirements, {
        moduleId: "eventsAdmin",
        adminOnly: false,
        requiredRoles: [],
      }),
    ).rejects.toThrow(/Only administrators/);
    await expect(
      asMember.mutation(api.modules.updateModuleStatus, { moduleId: "hoses", isEnabled: false }),
    ).rejects.toThrow(/Only administrators/);
  });

  it("can't see every account's details", async () => {
    const { asMember } = await setup();
    expect(await asMember.query(api.users.getUsers, {})).toEqual([]);
    const members = await asMember.query(api.users.getMemberUsers, {});
    expect(members.length).toBeGreaterThan(0);
    for (const m of members) {
      expect(m).not.toHaveProperty("email");
      expect(m).not.toHaveProperty("memberNumber");
    }
  });

  it("is held to the module's gate", async () => {
    const { t, asMember } = await setup();
    await t.run(async (ctx) => {
      const hoses = await ctx.db
        .query("moduleSettings")
        .withIndex("by_moduleId", (q) => q.eq("moduleId", "hoses"))
        .first();
      await ctx.db.patch(hoses!._id, { minimumRank: "Lieutenant" });
    });
    await expect(asMember.query(api.hoses.list, {})).rejects.toThrow(/access/);
    expect(await asMember.query(api.hoseAuditTrail.getRecentChanges, {})).toEqual([]);
  });

  it("can't push to the brigade", async () => {
    const { asMember, member } = await setup();
    await expect(
      asMember.action(api.pushNotificationAction.sendNotification, { title: "hi", body: "hi", userId: member }),
    ).rejects.toThrow();
  });
});

describe("Duty Officer", () => {
  it("is set by Lieutenants, Captains and admins only", async () => {
    const { t, asMember, asLieutenant, member } = await setup();
    await expect(asMember.mutation(api.availability.setDutyOfficer, { userId: member })).rejects.toThrow(
      /Only officers/,
    );
    await asLieutenant.mutation(api.availability.setDutyOfficer, { userId: member });
    const sam = await t.run((ctx) => ctx.db.get(member));
    expect(sam?.isDutyOfficer).toBe(true);
  });

  it("can't be given to a pending sign-up", async () => {
    const { asLieutenant, pending } = await setup();
    await expect(asLieutenant.mutation(api.availability.setDutyOfficer, { userId: pending })).rejects.toThrow(
      /can't be made Duty Officer/,
    );
  });
});

describe("a disabled admin", () => {
  it("keeps no access, even with a live session", async () => {
    const { asDisabledAdmin } = await setup();
    const access = await asDisabledAdmin.query(api.modules.getAllModuleAccess, {});
    expect(access.admin).toBe(false);
    expect(await asDisabledAdmin.query(api.users.getUsers, {})).toEqual([]);
    await expect(
      asDisabledAdmin.mutation(api.modules.updateModuleStatus, { moduleId: "hoses", isEnabled: false }),
    ).rejects.toThrow(/disabled/);
  });
});

describe("password reset", () => {
  it("stores only a hash of the token, and ignores disabled accounts", async () => {
    const { t } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("users", { name: "Gone", email: "gone@example.com", isDisabled: true }),
    );
    await t.mutation(api.passwordReset.requestPasswordReset, { email: "sam@example.com" });
    await t.mutation(api.passwordReset.requestPasswordReset, { email: "gone@example.com" });
    const tokens = await t.run((ctx) => ctx.db.query("passwordResetTokens").collect());
    expect(tokens.map((tok) => tok.email)).toEqual(["sam@example.com"]);
    expect(tokens[0].token).toMatch(/^[0-9a-f]{64}$/);
    await t.finishAllScheduledFunctions(() => {});
  });
});
