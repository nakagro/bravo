// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
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

  it("rejects submission while any item is unresolved", async () => {
    const { dutyCrewId, asUser } = await setup();

    await expect(
      asUser.mutation(api.stationChecks.submitStationCheck, {
        date: SUNDAY,
        dutyCrewId,
        checkItems: [
          item("Sweep floor", { isCompleted: true }),
          item("Mow lawn"),
        ],
      })
    ).rejects.toThrow("Mow lawn");
  });
});
