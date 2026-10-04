// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { tuesdayKind, tuesdaysBetween } from "./lib/rollNights";

const modules = import.meta.glob("./**/*.ts");

// Tue 6 Oct 2026 is training; Tue 13 Oct is the 2nd Tuesday - the meeting
const TRAINING = "2026-10-06";
const MEETING = "2026-10-13";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("moduleSettings", {
      moduleId: "training",
      moduleName: "Training Roll",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      minimumRank: "Lieutenant",
      updatedAt: 0,
    });
    const captainId = await ctx.db.insert("users", {
      firstName: "Kim",
      lastName: "Kerr",
      rank: "Captain" as const,
      memberNumber: "100",
    });
    const secondLtId = await ctx.db.insert("users", {
      firstName: "Sam",
      lastName: "Smith",
      rank: "Lieutenant" as const,
      lieutenantNumber: 2,
    });
    const firstLtId = await ctx.db.insert("users", {
      firstName: "Wil",
      lastName: "Wells",
      rank: "Lieutenant" as const,
      lieutenantNumber: 1,
    });
    const doId = await ctx.db.insert("users", {
      firstName: "Dee",
      lastName: "Oakes",
      rank: "Firefighter" as const,
      isDutyOfficer: true,
      memberNumber: "200",
    });
    const memberId = await ctx.db.insert("users", {
      firstName: "Ash",
      lastName: "Adams",
      rank: "Firefighter" as const,
      memberNumber: "300",
    });
    await ctx.db.insert("users", { name: "DO Phone", accountType: "shared" as const });
    return { captainId, secondLtId, firstLtId, doId, memberId };
  });
  return {
    t,
    ...ids,
    asCaptain: t.withIdentity({ subject: ids.captainId }),
    asDO: t.withIdentity({ subject: ids.doId }),
    asMember: t.withIdentity({ subject: ids.memberId }),
  };
}

const markOf = async (
  s: Awaited<ReturnType<typeof setup>>,
  date: string,
  lastName: string,
) => {
  const night = await s.asCaptain.query(api.training.getNight, { date });
  return night?.members.find((m) => m.member.lastName === lastName)?.mark?.status ?? null;
};

describe("roll nights", () => {
  it("makes every Tuesday a roll night and the 2nd Tuesday the meeting", () => {
    expect(tuesdaysBetween("2026-10-01", "2026-10-31")).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
    ]);
    expect(tuesdayKind(TRAINING)).toBe("training");
    expect(tuesdayKind(MEETING)).toBe("meeting");
  });

  it("refuses a one-off night on a regular Tuesday", async () => {
    const { asCaptain } = await setup();
    await expect(
      asCaptain.mutation(api.training.addNight, { date: TRAINING, title: "Exercise" }),
    ).rejects.toThrow(/already a roll night/);
    await asCaptain.mutation(api.training.addNight, { date: "2026-10-10", title: "Exercise" });
    const nights = await asCaptain.query(api.training.listNights, {
      from: "2026-10-01",
      to: "2026-10-14",
    });
    expect(nights.map((n) => [n.date, n.kind])).toEqual([
      ["2026-10-06", "training"],
      ["2026-10-10", "other"],
      ["2026-10-13", "meeting"],
    ]);
  });
});

describe("the roster", () => {
  it("calls Captain, then Lieutenants by number, then everyone else, including people without accounts", async () => {
    const s = await setup();
    await s.asCaptain.mutation(api.training.addRollMember, {
      firstName: "Noah",
      lastName: "Nobody",
      rank: "Firefighter",
    });

    const night = await s.asCaptain.query(api.training.getNight, { date: TRAINING });
    expect(night?.members.map((m) => m.member.lastName)).toEqual([
      "Kerr",
      "Wells",
      "Smith",
      "Adams",
      "Nobody",
      "Oakes",
    ]);
    // Shared logins are never on the roll
    expect(night?.members.some((m) => m.member.firstName === "DO")).toBe(false);
    expect(night?.members.find((m) => m.member.lastName === "Nobody")?.member.hasAccount).toBe(
      false,
    );
  });

  it("matches a hand-added member to their account by CFA ID instead of listing them twice", async () => {
    const s = await setup();
    await s.asCaptain.mutation(api.training.addRollMember, {
      firstName: "Ashley",
      lastName: "Adams",
      memberNumber: "300",
    });
    const roster = await s.asCaptain.query(api.training.getRoster, {});
    const adams = roster.filter((m) => m.lastName === "Adams");
    expect(adams).toHaveLength(1);
    expect(adams[0].hasAccount).toBe(true);
    expect(adams[0].userId).toBe(s.memberId);
  });
});

describe("marks", () => {
  it("lets the Duty Officer record an apology, and nothing else", async () => {
    const s = await setup();

    await s.asDO.mutation(api.training.setMark, {
      date: TRAINING,
      who: { userId: s.memberId },
      status: "apology",
    });
    expect(await markOf(s, TRAINING, "Adams")).toBe("apology");

    const night = await s.asCaptain.query(api.training.getNight, { date: TRAINING });
    expect(night?.members.find((m) => m.member.lastName === "Adams")?.mark?.recordedBy).toEqual({
      firstName: "Dee",
      lastName: "Oakes",
    });

    await expect(
      s.asDO.mutation(api.training.setMark, {
        date: TRAINING,
        who: { userId: s.captainId },
        status: "present",
      }),
    ).rejects.toThrow(/only record apologies/);
    await expect(
      s.asDO.mutation(api.training.closeRoll, { date: TRAINING }),
    ).rejects.toThrow(/Only officers/);
  });

  it("keeps ordinary members out entirely", async () => {
    const s = await setup();
    expect(await s.asMember.query(api.training.getNight, { date: TRAINING })).toBeNull();
    await expect(
      s.asMember.mutation(api.training.setMark, {
        date: TRAINING,
        who: { userId: s.memberId },
        status: "apology",
      }),
    ).rejects.toThrow(/Only officers or the Duty Officer/);
  });

  it("closes the roll by marking everyone left Absent, and allows a late apology after", async () => {
    const s = await setup();
    for (const userId of [s.captainId, s.firstLtId]) {
      await s.asCaptain.mutation(api.training.setMark, {
        date: TRAINING,
        who: { userId },
        status: "present",
      });
    }
    await s.asDO.mutation(api.training.setMark, {
      date: TRAINING,
      who: { userId: s.memberId },
      status: "apology",
    });

    const absent = await s.asCaptain.mutation(api.training.closeRoll, { date: TRAINING });
    expect(absent).toBe(2); // Smith and Oakes

    // Oakes rang the DO and it was never passed on - the Absent becomes an Apology
    await s.asCaptain.mutation(api.training.setMark, {
      date: TRAINING,
      who: { userId: s.doId },
      status: "apology",
    });
    expect(await markOf(s, TRAINING, "Oakes")).toBe("apology");

    // Clearing a mark on a closed roll leaves them Absent, never unmarked
    await s.asCaptain.mutation(api.training.setMark, {
      date: TRAINING,
      who: { userId: s.firstLtId },
      status: null,
    });
    expect(await markOf(s, TRAINING, "Wells")).toBe("absent");

    const history = await s.t.run(async (ctx) => ctx.db.query("rollMarkHistory").collect());
    expect(history.some((h) => h.oldStatus === "absent" && h.newStatus === "apology")).toBe(true);
  });

  it("refuses marks on a cancelled night", async () => {
    const s = await setup();
    await s.asCaptain.mutation(api.training.setNightCancelled, { date: TRAINING, cancelled: true });
    await expect(
      s.asCaptain.mutation(api.training.setMark, {
        date: TRAINING,
        who: { userId: s.captainId },
        status: "present",
      }),
    ).rejects.toThrow(/cancelled/);
  });
});

describe("report", () => {
  it("counts closed rolls only, filtered by kind", async () => {
    const s = await setup();
    await s.asCaptain.mutation(api.training.setMark, {
      date: TRAINING,
      who: { userId: s.memberId },
      status: "present",
    });
    await s.asCaptain.mutation(api.training.closeRoll, { date: TRAINING });
    await s.asCaptain.mutation(api.training.setMark, {
      date: MEETING,
      who: { userId: s.memberId },
      status: "apology",
    });
    await s.asCaptain.mutation(api.training.closeRoll, { date: MEETING });
    // Still open - not counted
    await s.asCaptain.mutation(api.training.setMark, {
      date: "2026-10-20",
      who: { userId: s.memberId },
      status: "present",
    });

    const all = await s.asCaptain.query(api.training.getReport, {
      from: "2026-10-01",
      to: "2026-10-31",
      kind: "all",
    });
    expect(all.nights).toHaveLength(2);
    expect(all.rows.find((r) => r.member.lastName === "Adams")).toMatchObject({
      present: 1,
      apology: 1,
      absent: 0,
    });

    const training = await s.asCaptain.query(api.training.getReport, {
      from: "2026-10-01",
      to: "2026-10-31",
      kind: "training",
    });
    expect(training.nights.map((n) => n.date)).toEqual([TRAINING]);
  });
});
