// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { weekWindow } from "./stationChecks";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Monday 3 Aug 2026, 04:15 AEST - the moment the cron closes the week of
// Mon 27 Jul - Sun 2 Aug (the first Sunday of August, so crew 1's week).
const CLOSE_RUN = Date.parse("2026-08-02T18:15:00Z");
const LAST_WEEK = weekWindow(CLOSE_RUN - 7 * 24 * 60 * 60 * 1000);
const THIS_WEEK = weekWindow(CLOSE_RUN);
const OLD_WEEK = weekWindow(CLOSE_RUN - 5 * 7 * 24 * 60 * 60 * 1000);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const memberId = await ctx.db.insert("users", {
      name: "Crew member",
      firstName: "Crew",
      lastName: "Member",
      rank: "Firefighter" as const,
    });
    const officerId = await ctx.db.insert("users", {
      name: "Duty officer",
      rank: "Lieutenant" as const,
    });
    const dutyCrewId = await ctx.db.insert("dutyCrew", {
      name: "Duty Crew 1",
      number: 1,
      members: [memberId],
      createdAt: CLOSE_RUN,
      updatedAt: CLOSE_RUN,
    });
    for (const [order, name] of ["Sweep bay", "Check BA sets"].entries()) {
      await ctx.db.insert("stationChecks", {
        name,
        isActive: true,
        order,
        createdBy: officerId,
        createdAt: CLOSE_RUN,
        updatedAt: CLOSE_RUN,
      });
    }
    await ctx.db.insert("moduleSettings", {
      moduleId: "dutyCrew",
      moduleName: "Duty Crew",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      updatedAt: CLOSE_RUN,
    });
    await ctx.db.insert("actionAccountability", {
      conditionKey: "dutyCrew:checksSubmitted",
      roles: [],
      userIds: [officerId],
      isEnabled: true,
      notifyInApp: true,
      notifyEmail: false,
    });
    return { memberId, officerId, dutyCrewId };
  });
  return {
    t,
    ...ids,
    asMember: t.withIdentity({ subject: ids.memberId }),
    asOfficer: t.withIdentity({ subject: ids.officerId }),
  };
}

const adHoc = (name: string, isCompleted: boolean) => ({ name, isCompleted, isAdHoc: true });

type Setup = Awaited<ReturnType<typeof setup>>;

const officerNotices = async (asOfficer: Setup["asOfficer"]) =>
  (await asOfficer.query(api.actionCentre.getMyActions, {})).filter(
    (a) => a.kind === "notice"
  );

describe("duty crew week close-out", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes the week that just ended and reports what wasn't done", async () => {
    const { t, dutyCrewId, asMember, asOfficer } = await setup();
    vi.setSystemTime(LAST_WEEK.start + 60 * 60 * 1000);
    const submissionId = await asMember.mutation(api.stationChecks.saveDraftStationCheck, {
      date: LAST_WEEK.end,
      dutyCrewId,
      checkItems: [adHoc("Sweep bay", true), adHoc("Mow lawn", false)],
    });

    vi.setSystemTime(CLOSE_RUN);
    await t.mutation(internal.stationChecks.closeElapsedWeeks, {});

    const closed = await t.run((ctx) => ctx.db.get(submissionId));
    expect(closed?.status).toBe("completed");
    expect(closed?.closedAt).toBe(CLOSE_RUN);
    // Ticked items keep the attribution of whoever ticked them
    expect(closed?.checkItems[0].completedBy).toBeDefined();

    const notices = await officerNotices(asOfficer);
    expect(notices).toHaveLength(1);
    expect(notices[0].title).toBe("Duty crew week closed");
    expect(notices[0].description).toContain("1 of 2 completed");
    expect(notices[0].description).toContain("1 not done");
  });

  it("closes a week nobody opened, with every check reported not done", async () => {
    const { t, dutyCrewId, asOfficer } = await setup();
    vi.setSystemTime(CLOSE_RUN);
    await t.mutation(internal.stationChecks.closeElapsedWeeks, {});

    const created = await t.run((ctx) =>
      ctx.db
        .query("stationCheckSubmissions")
        .withIndex("by_date", (q) => q.eq("date", LAST_WEEK.end))
        .unique()
    );
    expect(created?.dutyCrewId).toBe(dutyCrewId);
    expect(created?.status).toBe("completed");
    expect(created?.completedBy).toBeUndefined();
    expect(created?.checkItems.map((i) => i.name)).toEqual(["Sweep bay", "Check BA sets"]);
    expect(created?.crewSnapshot?.members).toHaveLength(1);

    const notices = await officerNotices(asOfficer);
    expect(notices).toHaveLength(1);
    expect(notices[0].description).toContain("0 of 2 completed");
  });

  it("is idempotent - a second run neither duplicates the week nor re-notifies", async () => {
    const { t, asOfficer } = await setup();
    vi.setSystemTime(CLOSE_RUN);
    await t.mutation(internal.stationChecks.closeElapsedWeeks, {});
    vi.setSystemTime(CLOSE_RUN + 24 * 60 * 60 * 1000);
    await t.mutation(internal.stationChecks.closeElapsedWeeks, {});

    const rows = await t.run((ctx) => ctx.db.query("stationCheckSubmissions").take(10));
    expect(rows).toHaveLength(1);
    expect(await officerNotices(asOfficer)).toHaveLength(1);
  });

  it("closes old abandoned drafts silently and leaves the running week alone", async () => {
    const { t, dutyCrewId, asMember, asOfficer } = await setup();
    vi.setSystemTime(OLD_WEEK.start + 60 * 60 * 1000);
    const oldId = await asMember.mutation(api.stationChecks.saveDraftStationCheck, {
      date: OLD_WEEK.end,
      dutyCrewId,
      checkItems: [adHoc("Sweep bay", false)],
    });
    await t.run((ctx) => ctx.db.patch(oldId, { crewSnapshot: undefined }));

    vi.setSystemTime(THIS_WEEK.start + 60 * 60 * 1000);
    const currentId = await asMember.mutation(api.stationChecks.saveDraftStationCheck, {
      date: THIS_WEEK.end,
      dutyCrewId,
      checkItems: [adHoc("Sweep bay", false)],
    });

    await t.mutation(internal.stationChecks.closeElapsedWeeks, {});

    const old = await t.run((ctx) => ctx.db.get(oldId));
    expect(old?.status).toBe("completed");
    // Today's roster is not a record of a week months ago
    expect(old?.crewSnapshot).toBeUndefined();
    expect((await t.run((ctx) => ctx.db.get(currentId)))?.status).toBe("draft");

    // Only last week (created as untouched) is reported, not the old one
    const notices = await officerNotices(asOfficer);
    expect(notices).toHaveLength(1);
    expect(notices[0].description).toContain("0 of 2 completed");
  });

  it("takes a late tick on a closed week without reopening it", async () => {
    const { t, dutyCrewId, asMember } = await setup();
    vi.setSystemTime(CLOSE_RUN);
    await t.mutation(internal.stationChecks.closeElapsedWeeks, {});

    const status = await asMember.query(api.stationChecks.getCurrentWeekCheckStatus, {
      date: LAST_WEEK.end,
    });
    expect(status?.submission.status).toBe("completed");
    expect(status?.completedBy).toBeUndefined();

    const items = status!.submission.checkItems.map((i, index) =>
      index === 0 ? { ...i, isCompleted: true } : i
    );
    await asMember.mutation(api.stationChecks.saveDraftStationCheck, {
      date: LAST_WEEK.end,
      dutyCrewId,
      checkItems: items,
      existingSubmissionId: status!.submission._id,
    });

    const after = await t.run((ctx) => ctx.db.get(status!.submission._id));
    expect(after?.status).toBe("completed");
    expect(after?.checkItems[0].isCompleted).toBe(true);
  });

  it("lists a system-closed week in History", async () => {
    const { t, asMember } = await setup();
    vi.setSystemTime(CLOSE_RUN);
    await t.mutation(internal.stationChecks.closeElapsedWeeks, {});

    const page = await asMember.query(api.stationChecks.getStationCheckHistoryPage, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toHaveLength(1);
    expect(page.page[0].completedBy).toBeUndefined();
    expect(page.page[0].closedAt).toBe(CLOSE_RUN);
  });
});
