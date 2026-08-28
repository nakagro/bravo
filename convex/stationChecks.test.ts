// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { buildSubmissionNotice, weekWindow } from "./stationChecks";
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

  // There is deliberately no completeness gate - see submitStationCheck. A week
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

describe("station check template subitems", () => {
  it("creates, updates, and returns ordered required subitems", async () => {
    const { asUser } = await setup();

    const checkId = await asUser.mutation(
      api.stationChecks.createStationCheck,
      {
        name: "Weekly pumper inspection",
        isPriority: true,
        isActive: true,
        subItems: ["Check fuel level", "Run the pump"],
      }
    );

    let checks = await asUser.query(api.stationChecks.getAllStationChecks, {});
    expect(checks).toHaveLength(1);
    expect(checks[0].subItems.map((subItem) => subItem.name)).toEqual([
      "Check fuel level",
      "Run the pump",
    ]);

    const firstSubItemId = checks[0].subItems[0]._id;
    await asUser.mutation(api.stationChecks.updateStationCheck, {
      id: checkId,
      subItems: ["Check diesel level", "Run the pump", "Test scene lights"],
    });

    checks = await asUser.query(api.stationChecks.getAllStationChecks, {});
    expect(checks[0].subItems.map((subItem) => subItem.name)).toEqual([
      "Check diesel level",
      "Run the pump",
      "Test scene lights",
    ]);
    expect(checks[0].subItems[0]._id).toBe(firstSubItemId);
  });

  it("preserves a subitem's parent relationship in a weekly submission", async () => {
    const { t, userId, dutyCrewId, asUser } = await setup();
    const checkId = await t.run((ctx) =>
      ctx.db.insert("stationChecks", {
        name: "Weekly tanker inspection",
        isActive: true,
        order: 10,
        createdBy: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );
    const subItemId = await t.run((ctx) =>
      ctx.db.insert("stationCheckSubitems", {
        stationCheckId: checkId,
        name: "Test warning lights",
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );

    const submissionId = await asUser.mutation(
      api.stationChecks.saveDraftStationCheck,
      {
        date: SUNDAY,
        dutyCrewId,
        checkItems: [
          { checkId, name: "Weekly tanker inspection", isCompleted: false },
          {
            subItemId,
            parentCheckId: checkId,
            name: "Test warning lights",
            isCompleted: true,
          },
        ],
      }
    );

    const saved = await t.run((ctx) => ctx.db.get(submissionId));
    expect(saved?.checkItems[1]).toMatchObject({
      subItemId,
      parentCheckId: checkId,
      isCompleted: true,
      completedBy: userId,
    });
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
    expect(result.attention).toContain("Mow lawn - not done");
  });

  it("includes a note left on an untouched item", () => {
    const result = notice([
      { name: "Mow lawn", isCompleted: false, notes: "Mower is out for service" },
    ]);

    expect(result.attention).toEqual([
      "Mow lawn - not done: Mower is out for service",
    ]);
  });

  it("lists untouched items ahead of N/A items", () => {
    const result = notice([
      { name: "Check hoses", isCompleted: false, isNotApplicable: true, notes: "Truck away" },
      { name: "Mow lawn", isCompleted: false },
    ]);

    expect(result.attention[0]).toBe("Mow lawn - not done");
    expect(result.attention[1]).toBe("Check hoses - marked N/A: Truck away");
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

describe("crew roster snapshot", () => {
  it("captures the crew on the first save and keeps it when the roster changes", async () => {
    const { t, userId, dutyCrewId, asUser } = await setup();

    const submissionId = await asUser.mutation(
      api.stationChecks.saveDraftStationCheck,
      { date: SUNDAY, dutyCrewId, checkItems: [item("Check hoses")] }
    );

    const captured = await t.run((ctx) => ctx.db.get(submissionId));
    expect(captured?.crewSnapshot?.name).toBe("Duty Crew 1");
    expect(captured?.crewSnapshot?.members.map((m) => m.userId)).toEqual([userId]);

    // Member leaves the crew and it is renamed after the week was worked
    const replacementId = await t.run(async (ctx) => {
      const replacementId = await ctx.db.insert("users", { name: "New member" });
      await ctx.db.patch(dutyCrewId, {
        name: "Duty Crew 1 (renamed)",
        members: [replacementId],
      });
      return replacementId;
    });

    await asUser.mutation(api.stationChecks.submitStationCheck, {
      date: SUNDAY,
      dutyCrewId,
      checkItems: [item("Check hoses", { isCompleted: true })],
      existingSubmissionId: submissionId,
    });

    const afterChange = await t.run((ctx) => ctx.db.get(submissionId));
    expect(afterChange?.crewSnapshot?.name).toBe("Duty Crew 1");
    expect(afterChange?.crewSnapshot?.members.map((m) => m.userId)).toEqual([
      userId,
    ]);
    expect(afterChange?.crewSnapshot?.members.map((m) => m.userId)).not.toContain(
      replacementId
    );
  });

  it("backfills a snapshot onto a submission that predates the field", async () => {
    const { t, userId, dutyCrewId, asUser } = await setup();

    const submissionId = await t.run((ctx) =>
      ctx.db.insert("stationCheckSubmissions", {
        date: SUNDAY,
        dutyCrewId,
        completedBy: userId,
        completedAt: Date.now(),
        status: "draft",
        checkItems: [],
      })
    );

    await asUser.mutation(api.stationChecks.saveDraftStationCheck, {
      date: SUNDAY,
      dutyCrewId,
      checkItems: [item("Check hoses")],
      existingSubmissionId: submissionId,
    });

    const saved = await t.run((ctx) => ctx.db.get(submissionId));
    expect(saved?.crewSnapshot?.members.map((m) => m.userId)).toEqual([userId]);
  });
});

describe("weekWindow resolves a Melbourne week", () => {
  // Formats an instant as Melbourne wall clock, so the assertions below read
  // as the boundary a member in Victoria actually experiences.
  const inMelbourne = (ts: number) =>
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(ts));

  it("starts on Melbourne Monday midnight during AEST", () => {
    // Wed 26 Aug 2026, midday Melbourne (UTC+10)
    const w = weekWindow(Date.UTC(2026, 7, 26, 2, 0, 0));
    expect(inMelbourne(w.start)).toBe("Mon, 24/08/2026, 00:00:00");
    expect(inMelbourne(w.end)).toBe("Sun, 30/08/2026, 23:59:59");
  });

  it("starts on Melbourne Monday midnight during AEDT", () => {
    // Wed 9 Dec 2026, midday Melbourne (UTC+11)
    const w = weekWindow(Date.UTC(2026, 11, 9, 1, 0, 0));
    expect(inMelbourne(w.start)).toBe("Mon, 07/12/2026, 00:00:00");
    expect(inMelbourne(w.end)).toBe("Sun, 13/12/2026, 23:59:59");
  });

  it("puts a Monday-morning check in the week that is starting, not the one that ended", () => {
    // Mon 24 Aug 2026, 08:00 Melbourne - the usual time these get done, and
    // the case the UTC-based window got wrong by putting it in the prior week.
    const mondayMorning = Date.UTC(2026, 7, 23, 22, 0, 0);
    const w = weekWindow(mondayMorning);
    expect(mondayMorning).toBeGreaterThanOrEqual(w.start);
    expect(mondayMorning).toBeLessThanOrEqual(w.end);
    expect(inMelbourne(w.start)).toBe("Mon, 24/08/2026, 00:00:00");
  });

  it("treats Sunday as the end of its own week, not the start of the next", () => {
    // Sun 30 Aug 2026, 20:00 Melbourne
    const w = weekWindow(Date.UTC(2026, 7, 30, 10, 0, 0));
    expect(inMelbourne(w.start)).toBe("Mon, 24/08/2026, 00:00:00");
    expect(inMelbourne(w.sunday.getTime())).toContain("30/08/2026");
  });

  it("returns consecutive, non-overlapping windows", () => {
    const a = weekWindow(Date.UTC(2026, 7, 26, 2, 0, 0));
    const b = weekWindow(a.end + 1);
    expect(b.start).toBe(a.end + 1);
  });

  it("keeps `sunday` as UTC midnight of the Sunday's calendar date", () => {
    // dutyCrewSchedule.date is keyed this way (see dutyCrew.ts:178), so the
    // schedule lookup in getCurrentWeekCheckStatus depends on it.
    const { sunday } = weekWindow(Date.UTC(2026, 7, 26, 2, 0, 0));
    expect(sunday.getTime()).toBe(Date.UTC(2026, 7, 30));
  });
});

// A linked row is ticked by the Inventory module, not by the member. The
// client posts the whole item array on every autosave, so these assert the
// *server* is what makes that true.
describe("linked inventory items", () => {
  // Mid-week, so a run completed "now" sits inside the same Melbourne week.
  const WEDNESDAY = new Date("2026-07-29T12:00:00+10:00").getTime();

  async function linkedSetup() {
    const base = await setup();
    const { t, userId } = base;

    const { templateId, checkId, inventoryUserId } = await t.run(async (ctx) => {
      const inventoryUserId = await ctx.db.insert("users", {
        name: "Equipment officer",
        firstName: "Equipment",
        lastName: "Officer",
      });
      const now = Date.now();
      const templateId = await ctx.db.insert("applianceTemplates", {
        name: "Pumper - MDA848",
        version: 1,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        updatedBy: userId,
      });
      const checkId = await ctx.db.insert("stationChecks", {
        name: "Pumper",
        area: "Inventory Checks",
        isActive: true,
        order: 10,
        linkedApplianceTemplateId: templateId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
      return { templateId, checkId, inventoryUserId };
    });

    const completeRun = async (completedAt: number) =>
      await t.run(async (ctx) =>
        await ctx.db.insert("applianceCheckRuns", {
          templateId,
          templateVersion: 1,
          templateName: "Pumper - MDA848",
          status: "completed" as const,
          startedBy: inventoryUserId,
          startedAt: completedAt - 60_000,
          completedBy: inventoryUserId,
          completedAt,
        })
      );

    const linkedItem = (isCompleted: boolean) => ({
      checkId,
      name: "Pumper",
      area: "Inventory Checks",
      isCompleted,
    });

    const savedItems = async (submissionId: string) =>
      await t.run(async (ctx) => {
        const sub = await ctx.db.get(submissionId as never);
        return (sub as { checkItems: Array<Record<string, unknown>> }).checkItems;
      });

    return { ...base, templateId, checkId, inventoryUserId, completeRun, linkedItem, savedItems };
  }

  it("overrides a client claiming completion when no run exists", async () => {
    // The security case: one crafted request must not be able to report a
    // 200-item inventory as done.
    const { asUser, dutyCrewId, linkedItem, savedItems } = await linkedSetup();

    const submissionId = await asUser.mutation(api.stationChecks.submitStationCheck, {
      date: WEDNESDAY,
      dutyCrewId,
      checkItems: [linkedItem(true)],
    });

    const [saved] = await savedItems(submissionId);
    expect(saved.isCompleted).toBe(false);
    expect(saved.linkedRunId).toBeUndefined();
  });

  it("resolves from a completed run inside the same week", async () => {
    const { asUser, dutyCrewId, completeRun, linkedItem, savedItems } = await linkedSetup();
    const runId = await completeRun(WEDNESDAY);

    const submissionId = await asUser.mutation(api.stationChecks.saveDraftStationCheck, {
      date: WEDNESDAY,
      dutyCrewId,
      checkItems: [linkedItem(false)],
    });

    const [saved] = await savedItems(submissionId);
    expect(saved.isCompleted).toBe(true);
    expect(saved.linkedRunId).toBe(runId);
  });

  it("ignores a run completed in a different week", async () => {
    const { asUser, dutyCrewId, completeRun, linkedItem, savedItems } = await linkedSetup();
    // Same appliance, but done last week - the obligation is weekly.
    await completeRun(WEDNESDAY - 7 * 24 * 60 * 60 * 1000);

    const submissionId = await asUser.mutation(api.stationChecks.saveDraftStationCheck, {
      date: WEDNESDAY,
      dutyCrewId,
      checkItems: [linkedItem(true)],
    });

    const [saved] = await savedItems(submissionId);
    expect(saved.isCompleted).toBe(false);
  });

  it("credits the run's completer, not whoever autosaved", async () => {
    // The applyItemAttribution ordering trap: attribution restamps a newly
    // resolved item with the saving user, which would credit the wrong person.
    const { asUser, dutyCrewId, inventoryUserId, completeRun, linkedItem, savedItems } =
      await linkedSetup();
    await completeRun(WEDNESDAY);

    const submissionId = await asUser.mutation(api.stationChecks.saveDraftStationCheck, {
      date: WEDNESDAY,
      dutyCrewId,
      checkItems: [linkedItem(false)],
    });

    const [saved] = await savedItems(submissionId);
    expect(saved.completedBy).toBe(inventoryUserId);
    expect(saved.completedAt).toBe(WEDNESDAY);
  });

  it("clears N/A on a linked item", async () => {
    // A derived row is either done or not; a member can't excuse it.
    const { asUser, dutyCrewId, checkId, savedItems } = await linkedSetup();

    const submissionId = await asUser.mutation(api.stationChecks.saveDraftStationCheck, {
      date: WEDNESDAY,
      dutyCrewId,
      checkItems: [
        { checkId, name: "Pumper", isCompleted: false, isNotApplicable: true },
      ],
    });

    const [saved] = await savedItems(submissionId);
    expect(saved.isNotApplicable).toBeUndefined();
    expect(saved.isCompleted).toBe(false);
  });

  it("leaves unlinked items alone", async () => {
    const { asUser, dutyCrewId, userId, linkedItem, savedItems } = await linkedSetup();

    const submissionId = await asUser.mutation(api.stationChecks.saveDraftStationCheck, {
      date: WEDNESDAY,
      dutyCrewId,
      checkItems: [linkedItem(false), item("Mow lawn", { isCompleted: true })],
    });

    const saved = await savedItems(submissionId);
    expect(saved).toHaveLength(2);
    // Ordinary items keep normal attribution - the two paths mustn't cross.
    expect(saved[1].name).toBe("Mow lawn");
    expect(saved[1].isCompleted).toBe(true);
    expect(saved[1].completedBy).toBe(userId);
  });

  it("reports derived state through getLinkedInventoryStatus", async () => {
    const { asUser, completeRun } = await linkedSetup();
    const runId = await completeRun(WEDNESDAY);

    const [status] = await asUser.query(api.stationChecks.getLinkedInventoryStatus, {
      date: WEDNESDAY,
    });

    expect(status.templateName).toBe("Pumper - MDA848");
    expect(status.templateStatus).toBe("active");
    expect(status.completedRunId).toBe(runId);
    expect(status.completedByName).toBe("Equipment Officer");
  });

  it("does not change a submitted week when a run is completed afterwards", async () => {
    // A past week is a record of what was done by the deadline. If it
    // re-derived, completing an inventory in September would silently mark
    // August's checklist as having been done.
    const { t, asUser, dutyCrewId, linkedItem, completeRun, savedItems } =
      await linkedSetup();

    const submissionId = await asUser.mutation(api.stationChecks.submitStationCheck, {
      date: WEDNESDAY,
      dutyCrewId,
      checkItems: [linkedItem(false)],
    });
    expect((await savedItems(submissionId))[0].isCompleted).toBe(false);

    await completeRun(WEDNESDAY);

    const stored = await savedItems(submissionId);
    expect(stored[0].isCompleted).toBe(false);
    expect(stored[0].linkedRunId).toBeUndefined();
    const status = await t.run(async (ctx) => {
      const sub = await ctx.db.get(submissionId as never);
      return (sub as { status: string }).status;
    });
    expect(status).toBe("completed");
  });

  it("returns a submitted linked item through the history page", async () => {
    // The history query has its own inline returns validator, separate from
    // checkItemValidator - it has to carry the link fields or reading back any
    // week containing a linked row fails.
    const { asUser, dutyCrewId, linkedItem, completeRun } = await linkedSetup();
    const runId = await completeRun(WEDNESDAY);

    await asUser.mutation(api.stationChecks.submitStationCheck, {
      date: WEDNESDAY,
      dutyCrewId,
      checkItems: [linkedItem(false)],
    });

    const page = await asUser.query(api.stationChecks.getStationCheckHistoryPage, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    const item = page.page[0].checkItems[0];
    expect(item.linkedRunId).toBe(runId);
    expect(item.isCompleted).toBe(true);
  });

  it("reports a non-active template so the row can be hidden", async () => {
    const { t, asUser, templateId } = await linkedSetup();
    await t.run(async (ctx) => {
      await ctx.db.patch(templateId, { status: "inactive" });
    });

    const [status] = await asUser.query(api.stationChecks.getLinkedInventoryStatus, {
      date: WEDNESDAY,
    });

    expect(status.templateStatus).toBe("inactive");
  });
});
