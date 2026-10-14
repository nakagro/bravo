// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { weekClosingMessage } from "./dutyCrewReminders";
import { weekWindow } from "./stationChecks";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Sun 2 Aug 2026 is the first Sunday of August (crew 1's week), Sun 9 Aug the
// second (crew 2's). Under the Tuesday changeover, crew 1 holds the week from
// Tue 28 Jul to Mon 3 Aug and crew 2 takes over on Tue 4 Aug.
const MONDAY_4PM = Date.parse("2026-08-03T16:00:00+10:00");
const MONDAY_NIGHT = Date.parse("2026-08-03T21:00:00+10:00");
const TUESDAY_MORNING = Date.parse("2026-08-04T08:00:00+10:00");

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    // isAdmin bypasses moduleSettings gating in getMyActions
    const outgoingId = await ctx.db.insert("users", { name: "Outgoing", isAdmin: true });
    const incomingId = await ctx.db.insert("users", { name: "Incoming", isAdmin: true });
    const disabledId = await ctx.db.insert("users", { name: "Left", isDisabled: true });
    const crew1 = await ctx.db.insert("dutyCrew", {
      name: "Duty Crew 1",
      number: 1,
      members: [outgoingId, disabledId],
      leader: outgoingId,
      createdAt: MONDAY_4PM,
      updatedAt: MONDAY_4PM,
    });
    const crew2 = await ctx.db.insert("dutyCrew", {
      name: "Duty Crew 2",
      number: 2,
      members: [incomingId],
      createdAt: MONDAY_4PM,
      updatedAt: MONDAY_4PM,
    });
    for (const [order, [name, area]] of [
      ["Sweep bay", "Station"],
      ["Mop floor", "Station"],
      ["Check BA sets", "Appliance"],
    ].entries()) {
      await ctx.db.insert("stationChecks", {
        name,
        area,
        isActive: true,
        order,
        createdBy: outgoingId,
        createdAt: MONDAY_4PM,
        updatedAt: MONDAY_4PM,
      });
    }
    return { outgoingId, incomingId, disabledId, crew1, crew2 };
  });
  return {
    t,
    ...ids,
    asOutgoing: t.withIdentity({ subject: ids.outgoingId }),
    asIncoming: t.withIdentity({ subject: ids.incomingId }),
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;

const dutyReminder = async (as: Setup["asOutgoing"]) =>
  (await as.query(api.actionCentre.getMyActions, {})).filter((a) => a.kind === "dutyCrewWeek");

describe("duty crew reminders follow the Tuesday changeover", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the outgoing crew's Action Centre reminder through Monday night", async () => {
    const { asOutgoing, asIncoming } = await setup();
    vi.setSystemTime(MONDAY_NIGHT);

    const outgoing = await dutyReminder(asOutgoing);
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].description).toContain("Duty Crew 1");
    expect(outgoing[0].description).toContain("week ending Sun 2 Aug");
    expect(outgoing[0].count).toBe(3);
    expect(await dutyReminder(asIncoming)).toHaveLength(0);
  });

  it("hands the Action Centre reminder to the incoming crew on Tuesday", async () => {
    const { asOutgoing, asIncoming } = await setup();
    vi.setSystemTime(TUESDAY_MORNING);

    const incoming = await dutyReminder(asIncoming);
    expect(incoming).toHaveLength(1);
    expect(incoming[0].description).toContain("Duty Crew 2");
    expect(incoming[0].description).toContain("week ending Sun 9 Aug");
    expect(await dutyReminder(asOutgoing)).toHaveLength(0);
  });

  it("tells a member how many of the outstanding checks are theirs", async () => {
    const { asOutgoing, crew1 } = await setup();
    vi.setSystemTime(MONDAY_NIGHT);
    await asOutgoing.mutation(api.stationCheckAllocations.setAllocation, {
      date: MONDAY_NIGHT,
      dutyCrewId: crew1,
      target: { kind: "area", area: "Station" },
      assignedTo: (await asOutgoing.query(api.auth.loggedInUser, {}))!._id,
    });

    const [reminder] = await dutyReminder(asOutgoing);
    expect(reminder.description).toContain("2 of the checks left are allocated to you");
  });

  it("sends the Monday push to the outgoing crew, counting each member's share", async () => {
    const { t, asOutgoing, outgoingId, crew1 } = await setup();
    vi.setSystemTime(MONDAY_4PM);
    await asOutgoing.mutation(api.stationCheckAllocations.setAllocation, {
      date: MONDAY_4PM,
      dutyCrewId: crew1,
      target: { kind: "area", area: "Appliance" },
      assignedTo: outgoingId,
    });

    const target = await t.query(internal.dutyCrewReminders.weekClosingRecipients, {
      now: MONDAY_4PM,
    });
    expect(target?.crewName).toBe("Duty Crew 1");
    expect(target?.remaining).toBe(3);
    // The disabled member is skipped; the incoming crew isn't chased
    expect(target?.recipients).toEqual([{ userId: outgoingId, mine: 1 }]);
  });

  it("sends no push once everything is ticked or marked N/A", async () => {
    const { t, asOutgoing, crew1 } = await setup();
    vi.setSystemTime(MONDAY_4PM);
    await asOutgoing.mutation(api.stationChecks.saveDraftStationCheck, {
      date: weekWindow(MONDAY_4PM).end,
      dutyCrewId: crew1,
      checkItems: [
        { name: "Sweep bay", isCompleted: true, isAdHoc: true },
        { name: "Mop floor", isCompleted: false, isNotApplicable: true, isAdHoc: true },
      ],
    });

    expect(
      await t.query(internal.dutyCrewReminders.weekClosingRecipients, { now: MONDAY_4PM })
    ).toBeNull();
  });
});

describe("week closing push message", () => {
  it("names the member's own share when they have one", () => {
    expect(weekClosingMessage(3, 1)).toBe(
      "3 station checks still to do, 1 of them allocated to you. The duty week ends at midnight tonight."
    );
    expect(weekClosingMessage(1, 0)).toBe(
      "1 station check still to do. The duty week ends at midnight tonight."
    );
  });
});
