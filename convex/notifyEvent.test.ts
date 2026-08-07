// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const SUNDAY = new Date("2026-08-02T00:00:00").getTime();

/**
 * A submitter plus a lieutenant who holds the duty crew portfolio, with the
 * dutyCrew module open so notices survive the provider's module gate.
 */
async function setup() {
  const t = convexTest(schema, modules);

  const { submitterId, officerId, dutyCrewId } = await t.run(async (ctx) => {
    const submitterId = await ctx.db.insert("users", {
      name: "Crew member",
      firstName: "Crew",
      lastName: "Member",
      rank: "Firefighter" as const,
    });
    const officerId = await ctx.db.insert("users", {
      name: "Duty officer",
      firstName: "Duty",
      lastName: "Officer",
      rank: "Lieutenant" as const,
      email: "officer@example.com",
    });

    const dutyCrewId = await ctx.db.insert("dutyCrew", {
      name: "Duty Crew 1",
      number: 1,
      members: [submitterId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("moduleSettings", {
      moduleId: "dutyCrew",
      moduleName: "Duty Crew",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      updatedAt: Date.now(),
    });

    return { submitterId, officerId, dutyCrewId };
  });

  return {
    t,
    submitterId,
    officerId,
    dutyCrewId,
    asSubmitter: t.withIdentity({ subject: submitterId }),
    asOfficer: t.withIdentity({ subject: officerId }),
  };
}

async function mapPortfolio(
  t: ReturnType<typeof convexTest>,
  userIds: Id<"users">[],
  overrides: Partial<{ notifyEmail: boolean; isEnabled: boolean }> = {}
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("actionAccountability", {
      conditionKey: "dutyCrew:checksSubmitted",
      roles: [],
      userIds,
      isEnabled: overrides.isEnabled ?? true,
      notifyInApp: true,
      notifyEmail: overrides.notifyEmail ?? false,
    });
  });
}

const submit = (
  asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  dutyCrewId: Id<"dutyCrew">,
  checkItems: Array<{ name: string; isCompleted: boolean; isNotApplicable?: boolean; notes?: string }>
) =>
  asUser.mutation(api.stationChecks.submitStationCheck, {
    date: SUNDAY,
    dutyCrewId,
    checkItems: checkItems.map((i) => ({ ...i, isAdHoc: true })),
  });

describe("event notices", () => {
  it("raises a notice for the mapped portfolio holder when checks are submitted", async () => {
    const { t, officerId, dutyCrewId, asSubmitter, asOfficer } = await setup();
    await mapPortfolio(t, [officerId]);

    await submit(asSubmitter, dutyCrewId, [
      { name: "Sweep bay", isCompleted: true },
      { name: "Mow lawn", isCompleted: false, isNotApplicable: true, notes: "Fire ban" },
    ]);

    const actions = await asOfficer.query(api.actionCentre.getMyActions, {});
    const notice = actions.find((a) => a.kind === "notice");

    expect(notice).toBeDefined();
    expect(notice!.title).toBe("Duty crew checks submitted");
    expect(notice!.description).toContain("1 of 2 completed");
    expect(notice!.description).toContain("1 N/A");
    expect(notice!.dismissible).toBe(true);
  });

  it("does not notify the person who submitted the checks", async () => {
    const { t, officerId, submitterId, dutyCrewId, asSubmitter } = await setup();
    await mapPortfolio(t, [officerId, submitterId]);

    await submit(asSubmitter, dutyCrewId, [{ name: "Sweep bay", isCompleted: true }]);

    const actions = await asSubmitter.query(api.actionCentre.getMyActions, {});
    expect(actions.some((a) => a.kind === "notice")).toBe(false);
  });

  it("stays silent when nobody is mapped to the condition key", async () => {
    const { dutyCrewId, asSubmitter, asOfficer } = await setup();

    await submit(asSubmitter, dutyCrewId, [{ name: "Sweep bay", isCompleted: true }]);

    const actions = await asOfficer.query(api.actionCentre.getMyActions, {});
    expect(actions.some((a) => a.kind === "notice")).toBe(false);
  });

  it("resolves role holders as well as named users", async () => {
    const { t, dutyCrewId, asSubmitter, asOfficer, officerId } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.patch(officerId, { roles: ["Duty Crew Manager"] });
      await ctx.db.insert("actionAccountability", {
        conditionKey: "dutyCrew:checksSubmitted",
        roles: ["Duty Crew Manager"],
        userIds: [],
        isEnabled: true,
        notifyInApp: true,
        notifyEmail: false,
      });
    });

    await submit(asSubmitter, dutyCrewId, [{ name: "Sweep bay", isCompleted: true }]);

    const actions = await asOfficer.query(api.actionCentre.getMyActions, {});
    expect(actions.some((a) => a.kind === "notice")).toBe(true);
  });

  it("updates the existing notice instead of stacking when checks are resubmitted", async () => {
    const { t, officerId, dutyCrewId, asSubmitter, asOfficer } = await setup();
    await mapPortfolio(t, [officerId]);

    await submit(asSubmitter, dutyCrewId, [{ name: "Sweep bay", isCompleted: true }]);
    await submit(asSubmitter, dutyCrewId, [
      { name: "Sweep bay", isCompleted: true },
      { name: "Check BA", isCompleted: true },
    ]);

    const notices = await t.run((ctx) => ctx.db.query("actionNotices").collect());
    expect(notices).toHaveLength(1);

    const actions = await asOfficer.query(api.actionCentre.getMyActions, {});
    const notice = actions.find((a) => a.kind === "notice");
    expect(notice!.description).toContain("2 completed");
  });
});

describe("action dismissal", () => {
  it("hides a dismissed notice from the recipient only", async () => {
    const { t, officerId, dutyCrewId, asSubmitter, asOfficer } = await setup();
    const secondOfficerId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Second officer", rank: "Lieutenant" as const })
    );
    await mapPortfolio(t, [officerId, secondOfficerId]);

    await submit(asSubmitter, dutyCrewId, [{ name: "Sweep bay", isCompleted: true }]);

    const before = await asOfficer.query(api.actionCentre.getMyActions, {});
    const noticeId = before.find((a) => a.kind === "notice")!.id;

    await asOfficer.mutation(api.actionCentre.dismissAction, { actionId: noticeId });

    const after = await asOfficer.query(api.actionCentre.getMyActions, {});
    expect(after.some((a) => a.id === noticeId)).toBe(false);

    const asSecond = t.withIdentity({ subject: secondOfficerId });
    const otherView = await asSecond.query(api.actionCentre.getMyActions, {});
    expect(otherView.some((a) => a.id === noticeId)).toBe(true);
  });

  it("is idempotent when the same action is dismissed twice", async () => {
    const { t, officerId, dutyCrewId, asSubmitter, asOfficer } = await setup();
    await mapPortfolio(t, [officerId]);
    await submit(asSubmitter, dutyCrewId, [{ name: "Sweep bay", isCompleted: true }]);

    const actions = await asOfficer.query(api.actionCentre.getMyActions, {});
    const noticeId = actions.find((a) => a.kind === "notice")!.id;

    await asOfficer.mutation(api.actionCentre.dismissAction, { actionId: noticeId });
    await asOfficer.mutation(api.actionCentre.dismissAction, { actionId: noticeId });

    const rows = await t.run((ctx) => ctx.db.query("actionDismissals").collect());
    expect(rows).toHaveLength(1);
  });

  it("clears dismissals when the notice is raised again for the same subject", async () => {
    const { t, officerId, dutyCrewId, asSubmitter, asOfficer } = await setup();
    await mapPortfolio(t, [officerId]);

    await submit(asSubmitter, dutyCrewId, [{ name: "Sweep bay", isCompleted: true }]);
    const first = await asOfficer.query(api.actionCentre.getMyActions, {});
    const noticeId = first.find((a) => a.kind === "notice")!.id;
    await asOfficer.mutation(api.actionCentre.dismissAction, { actionId: noticeId });

    // Reopened and resubmitted — the checks changed, so it's worth another look.
    await submit(asSubmitter, dutyCrewId, [
      { name: "Sweep bay", isCompleted: true },
      { name: "Mow lawn", isCompleted: false, isNotApplicable: true },
    ]);

    const after = await asOfficer.query(api.actionCentre.getMyActions, {});
    expect(after.some((a) => a.id === noticeId)).toBe(true);
  });
});
