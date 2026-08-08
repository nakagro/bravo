// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { buildSubmissionNotice } from "./stationChecks";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const SUNDAY = new Date("2026-08-02T00:00:00").getTime();

async function setup() {
  const t = convexTest(schema, modules);
  const { userId, dutyCrewId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Checks tester" });
    const dutyCrewId = await ctx.db.insert("dutyCrew", {
      name: "Duty Crew 1",
      number: 1,
      members: [userId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { userId, dutyCrewId };
  });
  return { t, userId, dutyCrewId, asUser: t.withIdentity({ subject: userId }) };
}

const item = (
  name: string,
  overrides: Partial<{
    isCompleted: boolean;
    isNotApplicable: boolean;
    notes: string;
  }> = {}
) => ({
  name,
  isCompleted: overrides.isCompleted ?? false,
  isNotApplicable: overrides.isNotApplicable,
  notes: overrides.notes,
  isAdHoc: true,
});

describe("station checks N/A handling", () => {
  it("stamps attribution when an item is marked N/A and clears it when unset", async () => {
    const { t, userId, dutyCrewId, asUser } = await setup();

    const submissionId = await asUser.mutation(
      api.stationChecks.saveDraftStationCheck,
      {
        date: SUNDAY,
        dutyCrewId,
        checkItems: [item("Mow lawn", { isNotApplicable: true, notes: "Total fire ban" })],
      }
    );

    let saved = await t.run((ctx) => ctx.db.get(submissionId));
    expect(saved?.checkItems[0].isNotApplicable).toBe(true);
    expect(saved?.checkItems[0].completedBy).toBe(userId);
    expect(saved?.checkItems[0].completedAt).toBeTypeOf("number");

    await asUser.mutation(api.stationChecks.saveDraftStationCheck, {
      date: SUNDAY,
      dutyCrewId,
      checkItems: [item("Mow lawn")],
      existingSubmissionId: submissionId,
    });

    saved = await t.run((ctx) => ctx.db.get(submissionId));
    expect(saved?.checkItems[0].completedBy).toBeUndefined();
    expect(saved?.checkItems[0].completedAt).toBeUndefined();
  });

  it("preserves the original stamp when the same resolution is saved again by another user", async () => {
    const { t, userId, dutyCrewId, asUser } = await setup();
    const otherUserId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Second member" })
    );
    const asOther = t.withIdentity({ subject: otherUserId });

    const submissionId = await asUser.mutation(
      api.stationChecks.saveDraftStationCheck,
      {
        date: SUNDAY,
        dutyCrewId,
        checkItems: [item("Empty bins", { isNotApplicable: true, notes: "Bins missing" })],
      }
    );

    await asOther.mutation(api.stationChecks.saveDraftStationCheck, {
      date: SUNDAY,
      dutyCrewId,
      checkItems: [item("Empty bins", { isNotApplicable: true, notes: "Bins missing" })],
      existingSubmissionId: submissionId,
    });

    const saved = await t.run((ctx) => ctx.db.get(submissionId));
    expect(saved?.checkItems[0].completedBy).toBe(userId);
  });

  it("re-stamps when a completed item is changed to N/A", async () => {
    const { t, userId, dutyCrewId, asUser } = await setup();
    const otherUserId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Second member" })
    );
    const asOther = t.withIdentity({ subject: otherUserId });

    const submissionId = await asUser.mutation(
      api.stationChecks.saveDraftStationCheck,
      {
        date: SUNDAY,
        dutyCrewId,
        checkItems: [item("Test pump", { isCompleted: true })],
      }
    );

    await asOther.mutation(api.stationChecks.saveDraftStationCheck, {
      date: SUNDAY,
      dutyCrewId,
      checkItems: [item("Test pump", { isNotApplicable: true, notes: "Pump away for service" })],
      existingSubmissionId: submissionId,
    });

    const saved = await t.run((ctx) => ctx.db.get(submissionId));
    expect(saved?.checkItems[0].isNotApplicable).toBe(true);
    expect(saved?.checkItems[0].isCompleted).toBe(false);
    expect(saved?.checkItems[0].completedBy).toBe(otherUserId);
    expect(saved?.checkItems[0].completedBy).not.toBe(userId);
  });

  it("treats completed as winning if a client sends both flags", async () => {
    const { t, dutyCrewId, asUser } = await setup();

    const submissionId = await asUser.mutation(
      api.stationChecks.saveDraftStationCheck,
      {
        date: SUNDAY,
        dutyCrewId,
        checkItems: [item("Sweep floor", { isCompleted: true, isNotApplicable: true })],
      }
    );

    const saved = await t.run((ctx) => ctx.db.get(submissionId));
    expect(saved?.checkItems[0].isCompleted).toBe(true);
    expect(saved?.checkItems[0].isNotApplicable).toBeUndefined();
  });

  it("allows submission when every item is completed or N/A", async () => {
    const { t, dutyCrewId, asUser } = await setup();

    const submissionId = await asUser.mutation(
      api.stationChecks.submitStationCheck,
      {
        date: SUNDAY,
        dutyCrewId,
        checkItems: [
          item("Sweep floor", { isCompleted: true }),
          item("Mow lawn", { isNotApplicable: true, notes: "Total fire ban" }),
        ],
      }
    );

    const saved = await t.run((ctx) => ctx.db.get(submissionId));
    expect(saved?.status).toBe("completed");
  });

  // There is deliberately no completeness gate — see submitStationCheck. A week
  // that can't be finished must still be submittable, because the notification
  // is what drives follow-up.
  it("allows submission while items are still unresolved", async () => {
    const { t, dutyCrewId, asUser } = await setup();

    const submissionId = await asUser.mutation(
      api.stationChecks.submitStationCheck,
      {
        date: SUNDAY,
        dutyCrewId,
        checkItems: [
          item("Sweep floor", { isCompleted: true }),
          item("Mow lawn"),
        ],
      }
    );

    const saved = await t.run((ctx) => ctx.db.get(submissionId));
    expect(saved?.status).toBe("completed");
    expect(saved?.checkItems[1].isCompleted).toBe(false);
    expect(saved?.checkItems[1].isNotApplicable).toBeUndefined();
  });
});

// The notice is the whole reason submission isn't gated: whatever was left
// undone has to reach the officer by name, or nobody follows it up.
describe("buildSubmissionNotice", () => {
  const notice = (items: Array<{
    name: string;
    isCompleted: boolean;
    isNotApplicable?: boolean;
    notes?: string;
  }>) => buildSubmissionNotice(items, "Duty Crew 1", SUNDAY);

  it("names untouched items and counts them in the summary", () => {
    const result = notice([
      { name: "Sweep floor", isCompleted: true },
      { name: "Mow lawn", isCompleted: false },
    ]);

    expect(result.notDoneCount).toBe(1);
    expect(result.summary).toContain("1 of 2 completed");
    expect(result.summary).toContain("1 not done");
    expect(result.attention).toContain("Mow lawn — not done");
  });

  it("includes a note left on an untouched item", () => {
    const result = notice([
      { name: "Mow lawn", isCompleted: false, notes: "Mower is out for service" },
    ]);

    expect(result.attention).toEqual([
      "Mow lawn — not done: Mower is out for service",
    ]);
  });

  it("lists untouched items ahead of N/A items", () => {
    const result = notice([
      { name: "Check hoses", isCompleted: false, isNotApplicable: true, notes: "Truck away" },
      { name: "Mow lawn", isCompleted: false },
    ]);

    expect(result.attention[0]).toBe("Mow lawn — not done");
    expect(result.attention[1]).toBe("Check hoses — marked N/A: Truck away");
  });

  it("reports nothing needing attention for a clean week", () => {
    const result = notice([
      { name: "Sweep floor", isCompleted: true },
      { name: "Check hoses", isCompleted: true },
    ]);

    expect(result.notDoneCount).toBe(0);
    expect(result.attention).toEqual([]);
    expect(result.summary).toBe("2 of 2 completed");
  });

  it("does not double-report a note on an item that is already flagged", () => {
    const result = notice([
      { name: "Mow lawn", isCompleted: false, notes: "Too wet" },
    ]);

    expect(result.attention).toHaveLength(1);
  });
});

// Exactly what ThisWeekTab computes for a week offset: the Sunday at end of day.
// The reader used to normalise that to midnight and re-derive the duty crew from
// the rotation rule, so a saved draft was invisible on reload and every tick
// looked like it had been thrown away.
function frontendSunday(weekOffset: number) {
  const today = new Date();
  const currentDay = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday.getTime();
}

describe("draft round trip", () => {
  for (const weekOffset of [0, 1, -1]) {
    it(`reads back a ticked item saved for week offset ${weekOffset}`, async () => {
      const { dutyCrewId, asUser } = await setup();
      const date = frontendSunday(weekOffset);

      await asUser.mutation(api.stationChecks.saveDraftStationCheck, {
        date,
        dutyCrewId,
        checkItems: [item("Mow lawn", { isCompleted: true })],
      });

      const status = await asUser.query(
        api.stationChecks.getCurrentWeekCheckStatus,
        { date }
      );
      expect(status?.submission.checkItems[0].isCompleted).toBe(true);
      expect(status?.dutyCrew._id).toBe(dutyCrewId);
    });
  }

  it("keeps a second tick on the same submission instead of forking a new one", async () => {
    const { t, dutyCrewId, asUser } = await setup();
    const date = frontendSunday(0);

    await asUser.mutation(api.stationChecks.saveDraftStationCheck, {
      date,
      dutyCrewId,
      checkItems: [item("Mow lawn", { isCompleted: true })],
    });
    // A later session ticks a second item without knowing the submission id
    await asUser.mutation(api.stationChecks.saveDraftStationCheck, {
      date: date - 1000, // a slightly different clock, same week
      dutyCrewId,
      checkItems: [
        item("Mow lawn", { isCompleted: true }),
        item("Check hoses", { isCompleted: true }),
      ],
    });

    const all = await t.run((ctx) =>
      ctx.db.query("stationCheckSubmissions").collect()
    );
    expect(all).toHaveLength(1);
    expect(all[0].checkItems).toHaveLength(2);
  });
});
