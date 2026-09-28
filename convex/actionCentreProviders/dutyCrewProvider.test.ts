// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { weekWindow } from "../stationChecks";

const modules = import.meta.glob("../**/*.ts");

// The provider works off the real clock, so tests pin a schedule override to
// the Sunday of the current Melbourne week (UTC midnight of its date - the
// dutyCrewSchedule key convention).
const thisWeeksSunday = () => weekWindow(Date.now()).sunday;

async function setup(opts: { onCrew: boolean }) {
  const t = convexTest(schema, modules);
  const sunday = thisWeeksSunday();
  const { userId, dutyCrewId } = await t.run(async (ctx) => {
    // isAdmin bypasses moduleSettings gating in getMyActions
    const userId = await ctx.db.insert("users", {
      name: "Duty tester",
      isAdmin: true,
    });
    const dutyCrewId = await ctx.db.insert("dutyCrew", {
      name: "Duty Crew 1",
      number: 1,
      members: opts.onCrew ? [userId] : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    // Something to tick - with no checks at all there's nothing to remind about
    await ctx.db.insert("stationChecks", {
      name: "Sweep bay",
      isActive: true,
      order: 0,
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("dutyCrewSchedule", {
      date: sunday.getTime(),
      dutyCrewId,
      isSpecial: false,
      createdBy: userId,
      updatedAt: Date.now(),
    });
    return { userId, dutyCrewId };
  });
  return {
    t,
    userId,
    dutyCrewId,
    sunday,
    asUser: t.withIdentity({ subject: userId }),
  };
}

const dutyActions = (actions: Array<{ moduleId: string }>) =>
  actions.filter((a) => a.moduleId === "dutyCrew");

describe("duty crew action centre provider", () => {
  it("raises a single reminder for members of this week's crew", async () => {
    const { asUser } = await setup({ onCrew: true });
    const actions = dutyActions(await asUser.query(api.actionCentre.getMyActions, {}));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: "dutyCrewWeek",
      url: "/dutycrew",
      priority: "medium",
    });
  });

  it("stays quiet for members not on this week's crew", async () => {
    const { asUser } = await setup({ onCrew: false });
    const actions = dutyActions(await asUser.query(api.actionCentre.getMyActions, {}));
    expect(actions).toHaveLength(0);
  });

  it("clears early once every item is ticked or marked N/A", async () => {
    const { t, userId, dutyCrewId, asUser } = await setup({ onCrew: true });
    await t.run(async (ctx) => {
      await ctx.db.insert("stationCheckSubmissions", {
        // Any instant inside the current week keys it
        date: weekWindow(Date.now()).end,
        dutyCrewId,
        completedBy: userId,
        completedAt: Date.now(),
        status: "draft",
        checkItems: [
          { name: "Empty bins", isCompleted: true },
          { name: "Mow lawn", isCompleted: false, isNotApplicable: true },
        ],
      });
    });
    const actions = dutyActions(await asUser.query(api.actionCentre.getMyActions, {}));
    expect(actions).toHaveLength(0);
  });

  it("counts what's left on a week in progress", async () => {
    const { t, userId, dutyCrewId, asUser } = await setup({ onCrew: true });
    await t.run(async (ctx) => {
      await ctx.db.insert("stationCheckSubmissions", {
        date: weekWindow(Date.now()).end,
        dutyCrewId,
        completedBy: userId,
        completedAt: Date.now(),
        status: "draft",
        checkItems: [
          { name: "Empty bins", isCompleted: true },
          { name: "Mow lawn", isCompleted: false },
        ],
      });
    });
    const actions = dutyActions(await asUser.query(api.actionCentre.getMyActions, {}));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ count: 1 });
  });
});
