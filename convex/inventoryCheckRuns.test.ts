// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { buildRunCompletionNotice } from "./inventoryCheckRuns";

const modules = import.meta.glob("./**/*.ts");

type ItemInput = {
  itemName: string;
  value?: "yes" | "no";
  expectedQuantity?: number;
  actualQuantity?: number;
  notes?: string;
};

/** Only the fields the notice builder reads. */
const asItem = (item: ItemInput) => item as unknown as Doc<"applianceCheckRunItems">;

// The notice is the whole point of the email: a completed run says nothing on
// its own, what matters is what wasn't on the appliance.
describe("buildRunCompletionNotice", () => {
  const notice = (items: ItemInput[]) =>
    buildRunCompletionNotice(items.map(asItem), "Pumper");

  it("names a missing item as a deviation", () => {
    const result = notice([
      { itemName: "Hose reel", value: "yes" },
      { itemName: "Spare torch", value: "no" },
    ]);

    expect(result.deviationCount).toBe(1);
    expect(result.summary).toBe("1 of 2 OK · 1 deviation");
    expect(result.attention).toContain("Spare torch - not on the appliance");
  });

  it("reports the expected and actual counts on a quantity mismatch", () => {
    const result = notice([
      { itemName: "Whiteboard markers", expectedQuantity: 4, actualQuantity: 2 },
    ]);

    expect(result.deviationCount).toBe(1);
    expect(result.attention).toEqual([
      "Whiteboard markers - expected 4, found 2",
    ]);
  });

  it("treats a matching quantity as OK", () => {
    const result = notice([
      { itemName: "Whiteboard markers", expectedQuantity: 4, actualQuantity: 4 },
    ]);

    expect(result.deviationCount).toBe(0);
    expect(result.attention).toEqual([]);
    expect(result.summary).toBe("1 of 1 OK");
  });

  it("names unchecked items separately from deviations", () => {
    const result = notice([
      { itemName: "Hose reel", value: "yes" },
      { itemName: "Spare torch", value: "no" },
      { itemName: "First aid kit" },
    ]);

    expect(result.notCheckedCount).toBe(1);
    expect(result.summary).toBe("1 of 3 OK · 1 deviation · 1 not checked");
    // Deviations lead - they affect whether the truck is ready.
    expect(result.attention[0]).toBe("Spare torch - not on the appliance");
    expect(result.attention[1]).toBe("First aid kit - not checked");
  });

  it("appends a note to the item it belongs to, without repeating it", () => {
    const result = notice([
      { itemName: "Spare torch", value: "no", notes: "Sent for repair" },
      { itemName: "Hose reel", value: "yes", notes: "Slight kink in the line" },
    ]);

    expect(result.attention).toEqual([
      "Spare torch - not on the appliance: Sent for repair",
      "Hose reel - Slight kink in the line",
    ]);
  });

  it("reports nothing needing attention for a clean run", () => {
    const result = notice([
      { itemName: "Hose reel", value: "yes" },
      { itemName: "Whiteboard markers", expectedQuantity: 4, actualQuantity: 4 },
    ]);

    expect(result.attention).toEqual([]);
    expect(result.description).toBe("Pumper · 2 of 2 OK");
  });
});

async function setup() {
  const t = convexTest(schema, modules);

  const { checkerId, officerId, templateId } = await t.run(async (ctx) => {
    const checkerId = await ctx.db.insert("users", {
      name: "Crew member",
      firstName: "Crew",
      lastName: "Member",
      rank: "Firefighter" as const,
    });
    const officerId = await ctx.db.insert("users", {
      name: "Equipment officer",
      firstName: "Equipment",
      lastName: "Officer",
      rank: "Lieutenant" as const,
      email: "equipment@example.com",
    });

    const now = Date.now();
    const templateId = await ctx.db.insert("applianceTemplates", {
      name: "Pumper",
      version: 1,
      createdBy: checkerId,
      createdAt: now,
      updatedAt: now,
      updatedBy: checkerId,
    });

    await ctx.db.insert("moduleSettings", {
      moduleId: "inventory",
      moduleName: "Inventory",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      updatedAt: now,
    });

    return { checkerId, officerId, templateId };
  });

  return {
    t,
    checkerId,
    officerId,
    templateId,
    asChecker: t.withIdentity({ subject: checkerId }),
    asOfficer: t.withIdentity({ subject: officerId }),
  };
}

async function mapPortfolio(
  t: ReturnType<typeof convexTest>,
  userIds: Id<"users">[]
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("actionAccountability", {
      conditionKey: "inventory:checkCompleted",
      roles: [],
      userIds,
      isEnabled: true,
      notifyInApp: true,
      notifyEmail: false,
    });
  });
}

async function seedRun(
  t: ReturnType<typeof convexTest>,
  templateId: Id<"applianceTemplates">,
  checkerId: Id<"users">,
  items: ItemInput[]
) {
  return await t.run(async (ctx) => {
    const runId = await ctx.db.insert("applianceCheckRuns", {
      templateId,
      templateVersion: 1,
      templateName: "Pumper",
      status: "in_progress" as const,
      startedBy: checkerId,
      startedAt: Date.now(),
    });
    let order = 0;
    for (const item of items) {
      await ctx.db.insert("applianceCheckRunItems", {
        runId,
        templateId,
        sectionName: "General",
        sectionOrder: 0,
        itemName: item.itemName,
        itemOrder: order++,
        itemType: "boolean" as const,
        value: item.value,
        expectedQuantity: item.expectedQuantity,
        actualQuantity: item.actualQuantity,
        notes: item.notes,
      });
    }
    return runId;
  });
}

describe("completeRun notifications", () => {
  it("raises a notice for the mapped portfolio holder", async () => {
    const { t, templateId, checkerId, officerId, asChecker, asOfficer } =
      await setup();
    await mapPortfolio(t, [officerId]);

    const runId = await seedRun(t, templateId, checkerId, [
      { itemName: "Hose reel", value: "yes" },
      { itemName: "Spare torch", value: "no" },
    ]);

    await asChecker.mutation(api.inventoryCheckRuns.completeRun, { runId });

    const actions = await asOfficer.query(api.actionCentre.getMyActions, {});
    const notice = actions.find((a) => a.kind === "notice");

    expect(notice).toBeDefined();
    expect(notice!.title).toBe("Inventory check completed");
    expect(notice!.description).toContain("Pumper");
    expect(notice!.description).toContain("1 deviation");
    // A missing item is an appliance-readiness problem, not an admin gap.
    expect(notice!.priority).toBe("high");
  });

  it("stays silent when nobody is mapped to the key", async () => {
    const { t, templateId, checkerId, asChecker, asOfficer } = await setup();

    const runId = await seedRun(t, templateId, checkerId, [
      { itemName: "Hose reel", value: "yes" },
    ]);

    await asChecker.mutation(api.inventoryCheckRuns.completeRun, { runId });

    const actions = await asOfficer.query(api.actionCentre.getMyActions, {});
    expect(actions.find((a) => a.kind === "notice")).toBeUndefined();
  });

  it("does not notify the person who completed the check", async () => {
    const { t, templateId, checkerId, asChecker } = await setup();
    await mapPortfolio(t, [checkerId]);

    const runId = await seedRun(t, templateId, checkerId, [
      { itemName: "Hose reel", value: "yes" },
    ]);

    await asChecker.mutation(api.inventoryCheckRuns.completeRun, { runId });

    const actions = await asChecker.query(api.actionCentre.getMyActions, {});
    expect(actions.find((a) => a.kind === "notice")).toBeUndefined();
  });

  it("does not raise a notice when a run is cancelled", async () => {
    const { t, templateId, checkerId, officerId, asChecker, asOfficer } =
      await setup();
    await mapPortfolio(t, [officerId]);

    const runId = await seedRun(t, templateId, checkerId, [
      { itemName: "Hose reel", value: "yes" },
    ]);

    await asChecker.mutation(api.inventoryCheckRuns.cancelRun, { runId });

    const actions = await asOfficer.query(api.actionCentre.getMyActions, {});
    expect(actions.find((a) => a.kind === "notice")).toBeUndefined();
  });
});

describe("completeRun guards", () => {
  it("treats a second completion as a no-op - one notice, original completer kept", async () => {
    const { t, templateId, checkerId, officerId, asChecker, asOfficer } =
      await setup();
    await mapPortfolio(t, [officerId]);
    const runId = await seedRun(t, templateId, checkerId, [
      { itemName: "Hose reel", value: "yes" },
    ]);

    await asChecker.mutation(api.inventoryCheckRuns.completeRun, { runId });
    const first = await t.run((ctx) => ctx.db.get(runId));
    await asOfficer.mutation(api.inventoryCheckRuns.completeRun, { runId });
    const second = await t.run((ctx) => ctx.db.get(runId));

    expect(second?.completedBy).toBe(checkerId);
    expect(second?.completedAt).toBe(first?.completedAt);
    const notices = (await asOfficer.query(api.actionCentre.getMyActions, {})).filter(
      (a) => a.kind === "notice"
    );
    expect(notices).toHaveLength(1);
  });

  it("refuses to complete a cancelled check", async () => {
    const { t, templateId, checkerId, asChecker } = await setup();
    const runId = await seedRun(t, templateId, checkerId, [
      { itemName: "Hose reel", value: "yes" },
    ]);
    await asChecker.mutation(api.inventoryCheckRuns.cancelRun, { runId });

    await expect(
      asChecker.mutation(api.inventoryCheckRuns.completeRun, { runId })
    ).rejects.toThrow("cancelled");
    expect((await t.run((ctx) => ctx.db.get(runId)))?.status).toBe("cancelled");
  });
});

describe("run summaries", () => {
  it("says who started an open check and how far it has got", async () => {
    const { t, templateId, checkerId, asChecker } = await setup();
    await seedRun(t, templateId, checkerId, [
      { itemName: "Hose reel", value: "yes" },
      { itemName: "Spare torch" },
      { itemName: "Branches", expectedQuantity: 2, actualQuantity: 2 },
    ]);

    const [run] = await asChecker.query(api.inventoryCheckRuns.getInProgressRuns, {});
    expect(run).toMatchObject({
      startedByName: "Crew Member",
      answeredCount: 2,
      itemCount: 3,
    });
  });

  it("counts a miscount as a deviation, not a yes", async () => {
    const { t, templateId, checkerId, asChecker } = await setup();
    await seedRun(t, templateId, checkerId, [
      { itemName: "Hose reel", value: "yes" },
      { itemName: "Spare torch", value: "no" },
      { itemName: "Branches", expectedQuantity: 2, actualQuantity: 1 },
      { itemName: "Nozzles" },
    ]);

    const { page } = await asChecker.query(api.inventoryCheckRuns.listRunSummariesPage, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page[0]).toMatchObject({ total: 4, yes: 1, no: 1, unanswered: 1, deviations: 2 });
  });

  it("filters History to one appliance on the server, beyond the newest page", async () => {
    const { t, templateId, checkerId, asChecker } = await setup();
    const tankerId = await t.run((ctx) =>
      ctx.db.insert("applianceTemplates", {
        name: "Tanker",
        version: 1,
        createdBy: checkerId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: checkerId,
      })
    );
    const tankerRun = await seedRun(t, tankerId, checkerId, [{ itemName: "Hose reel" }]);
    // Pumper checks pile up on top of the one Tanker check
    for (let i = 0; i < 3; i++) {
      await seedRun(t, templateId, checkerId, [{ itemName: "Hose reel" }]);
    }

    const newest = await asChecker.query(api.inventoryCheckRuns.listRunSummariesPage, {
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(newest.page.map((s) => s.run._id)).not.toContain(tankerRun);

    const tanker = await asChecker.query(api.inventoryCheckRuns.listRunSummariesPage, {
      templateId: tankerId,
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(tanker.page.map((s) => s.run._id)).toEqual([tankerRun]);
  });

  it("names who answered each item on the run", async () => {
    const { t, templateId, checkerId, asChecker } = await setup();
    const runId = await seedRun(t, templateId, checkerId, [{ itemName: "Hose reel" }]);
    const [item] = await t.run((ctx) =>
      ctx.db
        .query("applianceCheckRunItems")
        .withIndex("by_run", (q) => q.eq("runId", runId))
        .collect()
    );

    await asChecker.mutation(api.inventoryCheckRuns.updateRunItem, {
      runItemId: item._id,
      value: "yes",
    });

    const data = await asChecker.query(api.inventoryCheckRuns.getRun, { runId });
    expect(data?.items[0].updatedBy).toBe(checkerId);
    expect(data?.itemUsers).toEqual([
      expect.objectContaining({ _id: checkerId, firstName: "Crew", lastName: "Member" }),
    ]);
  });
});
