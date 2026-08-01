// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * Both gates open, one officer signed in. Access is `moduleSettings`-driven, so
 * every test needs the two rows; the permission tests below close them again.
 */
async function setup(options: { rank?: string; admin?: boolean } = {}) {
  const t = convexTest(schema, modules);

  const { officerId, memberId, otherMemberId } = await t.run(async (ctx) => {
    const officerId = await ctx.db.insert("users", {
      name: "Alex Carter",
      firstName: "Max",
      lastName: "Carter",
      rank: (options.rank ?? "Lieutenant") as "Lieutenant",
      isAdmin: options.admin ?? false,
    });
    const memberId = await ctx.db.insert("users", {
      name: "Jo Adams",
      firstName: "Jo",
      lastName: "Adams",
      memberNumber: "1234",
      rank: "Firefighter" as const,
    });
    const otherMemberId = await ctx.db.insert("users", {
      name: "Sam Zhu",
      firstName: "Sam",
      lastName: "Zhu",
      rank: "Firefighter" as const,
    });
    const updatedAt = Date.now();
    for (const moduleId of ["memberRecords", "memberRecordsAdmin"]) {
      await ctx.db.insert("moduleSettings", {
        moduleId,
        moduleName: moduleId,
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
        updatedAt,
      });
    }
    return { officerId, memberId, otherMemberId };
  });

  return { t, as: t.withIdentity({ subject: officerId }), officerId, memberId, otherMemberId };
}

describe("kit definitions", () => {
  it("creates a set with items and reads them back in order", async () => {
    const { as } = await setup();

    const setId = await as.mutation(api.memberKitAdmin.createSet, {
      name: "Structural PPC",
      description: "Ordered together",
    });
    await as.mutation(api.memberKitAdmin.createItem, {
      setId,
      name: "Jacket",
      tracks: "size",
    });
    await as.mutation(api.memberKitAdmin.createItem, { setId, name: "Boots", tracks: "size" });

    const defs = await as.query(api.memberKit.getKitDefinitions, {});
    expect(defs.sets).toHaveLength(1);
    expect(defs.sets[0].items.map((item) => item.name)).toEqual(["Jacket", "Boots"]);
    expect(defs.standalone).toEqual([]);
  });

  it("creates standalone items with no set at all", async () => {
    const { as } = await setup();

    await as.mutation(api.memberKitAdmin.createItem, { name: "Pager", tracks: "serial" });
    await as.mutation(api.memberKitAdmin.createItem, {
      name: "Station workwear",
      tracks: "held",
    });

    const defs = await as.query(api.memberKit.getKitDefinitions, {});
    expect(defs.sets).toEqual([]);
    expect(defs.standalone.map((item) => item.name)).toEqual(["Pager", "Station workwear"]);
    expect(defs.standalone[0].setId).toBeUndefined();
  });

  it("requires at least one option for a choice item", async () => {
    const { as } = await setup();
    await expect(
      as.mutation(api.memberKitAdmin.createItem, { name: "Helmet colour", tracks: "choice" }),
    ).rejects.toThrow(/at least one option/);
  });

  it("hides archived items but keeps them for the admin view", async () => {
    const { as } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });
    await as.mutation(api.memberKitAdmin.updateItem, { itemId, isArchived: true });

    expect((await as.query(api.memberKit.getKitDefinitions, {})).standalone).toEqual([]);
    expect(
      (await as.query(api.memberKit.getKitDefinitions, { includeArchived: true })).standalone,
    ).toHaveLength(1);
  });

  it("reorders sets and standalone items independently", async () => {
    const { as } = await setup();
    const a = await as.mutation(api.memberKitAdmin.createSet, { name: "A" });
    const b = await as.mutation(api.memberKitAdmin.createSet, { name: "B" });
    await as.mutation(api.memberKitAdmin.reorderSets, { setIds: [b, a] });

    const p = await as.mutation(api.memberKitAdmin.createItem, { name: "Pager", tracks: "serial" });
    const w = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Workwear",
      tracks: "held",
    });
    await as.mutation(api.memberKitAdmin.reorderItems, { setId: null, itemIds: [w, p] });

    const defs = await as.query(api.memberKit.getKitDefinitions, {});
    expect(defs.sets.map((set) => set.name)).toEqual(["B", "A"]);
    expect(defs.standalone.map((item) => item.name)).toEqual(["Workwear", "Pager"]);
  });
});

describe("recording values", () => {
  async function withSizedJacket() {
    const ctx = await setup();
    const setId = await ctx.as.mutation(api.memberKitAdmin.createSet, {
      name: "Structural PPC",
    });
    const itemId = await ctx.as.mutation(api.memberKitAdmin.createItem, {
      setId,
      name: "Jacket",
      tracks: "size",
    });
    const chartId = await ctx.as.mutation(api.memberKitAdmin.createChart, {
      itemId,
      name: "Supplier A",
      sizes: ["87", "92", "97"],
    });
    return { ...ctx, setId, itemId, chartId };
  }

  it("records, changes and clears a size", async () => {
    const { as, memberId, setId, itemId, chartId } = await withSizedJacket();

    await as.mutation(api.memberKit.setKitEntries, {
      userId: memberId,
      setId,
      entries: [{ itemId, value: { chartId, size: "92" } }],
    });

    let summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
    expect(summary?.sets[0].entries[0].display).toBe("Supplier A · 92");
    expect(summary?.recordedCount).toBe(1);
    expect(summary?.itemCount).toBe(1);

    await as.mutation(api.memberKit.setKitEntries, {
      userId: memberId,
      setId,
      entries: [{ itemId, value: null }],
    });

    summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
    expect(summary?.sets[0].entries[0].value).toBeUndefined();
    expect(summary?.recordedCount).toBe(0);
    // The clear is still the latest activity, even though no entry survives.
    expect(summary?.latestActivity?.changedByName).toBe("Alex Carter");
  });

  it("keeps all three held states distinct", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Station workwear",
      tracks: "held",
    });

    const read = async () => {
      const summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
      return summary?.standalone.entries[0];
    };

    expect((await read())?.value).toBeUndefined();

    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: false });
    expect((await read())?.value).toBe(false);
    expect((await read())?.display).toBe("Not issued");

    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: true });
    expect((await read())?.display).toBe("Issued");

    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: null });
    expect((await read())?.value).toBeUndefined();
    // "not recorded" is not the same as a recorded false
    expect((await read())?.display).toBeUndefined();
  });

  it("records a count, keeping a recorded zero distinct from not recorded", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Structural gear sets",
      tracks: "count",
    });

    const read = async () => {
      const summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
      return summary?.standalone.entries[0];
    };

    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: 2 });
    expect((await read())?.value).toBe(2);
    expect((await read())?.display).toBe("2");

    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: 0 });
    expect((await read())?.value).toBe(0);
    expect((await read())?.display).toBe("0");

    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: null });
    expect((await read())?.value).toBeUndefined();
  });

  it("rejects a count that is not a whole number, negative, or absurd", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Structural gear sets",
      tracks: "count",
    });

    for (const value of [1.5, -1, 10000]) {
      await expect(
        as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value }),
      ).rejects.toThrow();
    }
    await expect(
      as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "2" }),
    ).rejects.toThrow();
  });

  it("clears every item type through the same null path", async () => {
    const { as, memberId } = await setup();

    const serial = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });
    const note = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Notes",
      tracks: "note",
    });
    const date = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Issued",
      tracks: "date",
    });
    const choice = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Helmet",
      tracks: "choice",
      options: ["Yellow", "White"],
    });

    await as.mutation(api.memberKit.setKitEntries, {
      userId: memberId,
      setId: null,
      entries: [
        { itemId: serial, value: "EM-4471-93" },
        { itemId: note, value: "Left-handed" },
        { itemId: date, value: "2026-03-01" },
        { itemId: choice, value: "Yellow" },
      ],
    });
    expect(
      (await as.query(api.memberKit.getMemberKitSummary, { userId: memberId }))?.recordedCount,
    ).toBe(4);

    await as.mutation(api.memberKit.setKitEntries, {
      userId: memberId,
      setId: null,
      entries: [serial, note, date, choice].map((itemId) => ({ itemId, value: null })),
    });
    expect(
      (await as.query(api.memberKit.getMemberKitSummary, { userId: memberId }))?.recordedCount,
    ).toBe(0);
  });

  it("treats whitespace-only text as a clear", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });

    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "   " });
    const summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
    expect(summary?.standalone.entries[0].value).toBeUndefined();
  });

  it("rejects a date that is not YYYY-MM-DD", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Issued",
      tracks: "date",
    });
    await expect(
      as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "1/3/26" }),
    ).rejects.toThrow(/YYYY-MM-DD/);
  });

  it("rejects an option that is not on the item", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Helmet",
      tracks: "choice",
      options: ["Yellow"],
    });
    await expect(
      as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "Blue" }),
    ).rejects.toThrow(/not an option/);
  });

  it("rejects a size that is not in the chosen chart", async () => {
    const { as, memberId, itemId, chartId } = await withSizedJacket();
    await expect(
      as.mutation(api.memberKit.setKitEntry, {
        userId: memberId,
        itemId,
        value: { chartId, size: "104" },
      }),
    ).rejects.toThrow(/not a size for/);
  });

  it("rejects a chart belonging to another item", async () => {
    const { as, memberId, chartId } = await withSizedJacket();
    const otherItem = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Boots",
      tracks: "size",
    });
    await expect(
      as.mutation(api.memberKit.setKitEntry, {
        userId: memberId,
        itemId: otherItem,
        value: { chartId, size: "92" },
      }),
    ).rejects.toThrow(/does not belong to/);
  });

  it("rejects writes to an archived item", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });
    await as.mutation(api.memberKitAdmin.updateItem, { itemId, isArchived: true });
    await expect(
      as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "X" }),
    ).rejects.toThrow(/archived/);
  });
});

describe("editing scope", () => {
  it("scopes the editor to one standalone item, not a group of them", async () => {
    const { as, memberId } = await setup();
    const pager = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });
    await as.mutation(api.memberKitAdmin.createItem, {
      name: "Station workwear",
      tracks: "held",
    });
    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId: pager, value: "EM-1" });

    const scope = await as.query(api.memberKit.getKitScopeForEntry, {
      userId: memberId,
      setId: null,
      itemId: pager,
    });

    // The editor is titled with the item, and the workwear is nowhere near it.
    expect(scope?.title).toBe("Pager");
    expect(scope?.items).toHaveLength(1);
    expect(scope?.items[0].name).toBe("Pager");
    expect(scope?.values).toEqual([{ itemId: pager, value: "EM-1" }]);
  });

  it("titles a set scope with the set name and returns all its items", async () => {
    const { as, memberId } = await setup();
    const setId = await as.mutation(api.memberKitAdmin.createSet, { name: "Structural PPC" });
    await as.mutation(api.memberKitAdmin.createItem, { setId, name: "Jacket", tracks: "size" });
    await as.mutation(api.memberKitAdmin.createItem, { setId, name: "Pants", tracks: "size" });

    const scope = await as.query(api.memberKit.getKitScopeForEntry, {
      userId: memberId,
      setId,
    });
    expect(scope?.title).toBe("Structural PPC");
    expect(scope?.items.map((item) => item.name)).toEqual(["Jacket", "Pants"]);
  });

  it("refuses an item that does not live in the requested scope", async () => {
    const { as, memberId } = await setup();
    const setId = await as.mutation(api.memberKitAdmin.createSet, { name: "Comms" });
    const inSet = await as.mutation(api.memberKitAdmin.createItem, {
      setId,
      name: "Radio",
      tracks: "serial",
    });

    // Asking for a set item as though it were standalone finds nothing.
    const scope = await as.query(api.memberKit.getKitScopeForEntry, {
      userId: memberId,
      setId: null,
      itemId: inSet,
    });
    expect(scope).toBeNull();
  });
});

describe("batch saves reject as a whole", () => {
  it("rejects a duplicate item id without writing anything", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });

    await expect(
      as.mutation(api.memberKit.setKitEntries, {
        userId: memberId,
        setId: null,
        entries: [
          { itemId, value: "A" },
          { itemId, value: "B" },
        ],
      }),
    ).rejects.toThrow(/only appear once/);

    expect(
      (await as.query(api.memberKit.getMemberKitSummary, { userId: memberId }))?.recordedCount,
    ).toBe(0);
  });

  it("rejects the whole batch when one entry is invalid, with no partial writes", async () => {
    const { as, memberId } = await setup();
    const good = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });
    const bad = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Issued",
      tracks: "date",
    });

    await expect(
      as.mutation(api.memberKit.setKitEntries, {
        userId: memberId,
        setId: null,
        entries: [
          { itemId: good, value: "EM-1" },
          { itemId: bad, value: "not-a-date" },
        ],
      }),
    ).rejects.toThrow();

    expect(
      (await as.query(api.memberKit.getMemberKitSummary, { userId: memberId }))?.recordedCount,
    ).toBe(0);
  });

  it("rejects an item whose scope does not match the requested one", async () => {
    const { as, memberId } = await setup();
    const setId = await as.mutation(api.memberKitAdmin.createSet, { name: "Comms" });
    const inSet = await as.mutation(api.memberKitAdmin.createItem, {
      setId,
      name: "Radio",
      tracks: "serial",
    });
    const loose = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });

    // A set item submitted as standalone…
    await expect(
      as.mutation(api.memberKit.setKitEntries, {
        userId: memberId,
        setId: null,
        entries: [{ itemId: inSet, value: "R1" }],
      }),
    ).rejects.toThrow(/does not belong to this set/);

    // …and a standalone item submitted under a real set.
    await expect(
      as.mutation(api.memberKit.setKitEntries, {
        userId: memberId,
        setId,
        entries: [{ itemId: loose, value: "P1" }],
      }),
    ).rejects.toThrow(/does not belong to this set/);
  });

  it("bulk-fills one item across members and rejects a duplicate member", async () => {
    const { as, memberId, otherMemberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Station workwear",
      tracks: "held",
    });

    const result = await as.mutation(api.memberKit.setKitItemEntries, {
      itemId,
      entries: [
        { userId: memberId, value: true },
        { userId: otherMemberId, value: false },
      ],
    });
    expect(result.changed).toBe(2);

    await expect(
      as.mutation(api.memberKit.setKitItemEntries, {
        itemId,
        entries: [
          { userId: memberId, value: true },
          { userId: memberId, value: false },
        ],
      }),
    ).rejects.toThrow(/only appear once/);

    const all = await as.query(api.memberKit.getItemEntriesForAllMembers, { itemId });
    expect(all?.members.find((m) => m.userId === memberId)?.value).toBe(true);
    expect(all?.members.find((m) => m.userId === otherMemberId)?.value).toBe(false);
  });
});

describe("history", () => {
  async function historyFor(
    as: Awaited<ReturnType<typeof setup>>["as"],
    userId: Id<"users">,
  ) {
    const page = await as.query(api.memberKit.getMemberKitHistory, {
      userId,
      paginationOpts: { numItems: 50, cursor: null },
    });
    return page.page;
  }

  it("writes nothing for a no-op edit or a repeated clear", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });

    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "EM-1" });
    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "EM-1" });
    expect(await historyFor(as, memberId)).toHaveLength(1);

    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: null });
    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: null });
    expect(await historyFor(as, memberId)).toHaveLength(2);
    expect((await historyFor(as, memberId))[0].reason).toBe("cleared");
  });

  it("reads newest first and distinguishes edit from clear", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });

    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "EM-1" });
    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "EM-2" });
    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: null });

    const rows = await historyFor(as, memberId);
    expect(rows.map((row) => row.reason)).toEqual(["cleared", "edited", "edited"]);
    expect(rows[0].previousDisplay).toBe("EM-2");
    expect(rows[0].newDisplay).toBeUndefined();
    expect(rows[1]).toMatchObject({ previousDisplay: "EM-1", newDisplay: "EM-2" });
    expect(rows[2].previousDisplay).toBeUndefined();
    expect(rows[2].newDisplay).toBe("EM-1");
  });

  it("keeps its wording after the chart, item and set are renamed", async () => {
    const { as, memberId } = await setup();
    const setId = await as.mutation(api.memberKitAdmin.createSet, { name: "Structural PPC" });
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      setId,
      name: "Jacket",
      tracks: "size",
    });
    const chartId = await as.mutation(api.memberKitAdmin.createChart, {
      itemId,
      name: "Supplier A",
      sizes: ["92"],
    });
    await as.mutation(api.memberKit.setKitEntry, {
      userId: memberId,
      itemId,
      value: { chartId, size: "92" },
    });

    await as.mutation(api.memberKitAdmin.updateSet, { setId, name: "Structure" });
    await as.mutation(api.memberKitAdmin.updateItem, { itemId, name: "Coat" });
    await as.mutation(api.memberKitAdmin.updateChart, { chartId, name: "Supplier A (renamed)" });

    const rows = await historyFor(as, memberId);
    expect(rows[0]).toMatchObject({
      itemName: "Jacket",
      setName: "Structural PPC",
      newDisplay: "Supplier A · 92",
    });
  });

  it("survives deleting the chart, item and set it referenced", async () => {
    const { as, memberId } = await setup();
    const setId = await as.mutation(api.memberKitAdmin.createSet, { name: "Structural PPC" });
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      setId,
      name: "Jacket",
      tracks: "size",
    });
    const chartId = await as.mutation(api.memberKitAdmin.createChart, {
      itemId,
      name: "Supplier A",
      sizes: ["92"],
    });
    await as.mutation(api.memberKit.setKitEntry, {
      userId: memberId,
      itemId,
      value: { chartId, size: "92" },
    });

    await as.mutation(api.memberKitAdmin.deleteChart, { chartId });

    let rows = await historyFor(as, memberId);
    expect(rows[0]).toMatchObject({
      reason: "chartDeleted",
      previousDisplay: "Supplier A · 92",
      itemName: "Jacket",
      setName: "Structural PPC",
    });
    expect(rows[0].newDisplay).toBeUndefined();

    // Re-record, then delete the set out from under it.
    const chart2 = await as.mutation(api.memberKitAdmin.createChart, {
      itemId,
      name: "Supplier B",
      sizes: ["9"],
    });
    await as.mutation(api.memberKit.setKitEntry, {
      userId: memberId,
      itemId,
      value: { chartId: chart2, size: "9" },
    });
    await as.mutation(api.memberKitAdmin.deleteSet, { setId });

    rows = await historyFor(as, memberId);
    expect(rows[0]).toMatchObject({ reason: "setDeleted", previousDisplay: "Supplier B · 9" });

    const summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
    expect(summary?.sets).toEqual([]);
    // Latest activity still reports the cascade, not "nothing recorded".
    expect(summary?.latestActivity).toBeDefined();
  });

  it("records itemDeleted when a standalone item goes, with no set name", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });
    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "EM-1" });
    await as.mutation(api.memberKitAdmin.deleteItem, { itemId });

    const rows = await historyFor(as, memberId);
    expect(rows[0]).toMatchObject({ reason: "itemDeleted", itemName: "Pager" });
    expect(rows[0].setName).toBeUndefined();
  });

  it("paginates newest first", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });
    for (const value of ["A", "B", "C"]) {
      await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value });
    }

    const first = await as.query(api.memberKit.getMemberKitHistory, {
      userId: memberId,
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page).toHaveLength(2);
    expect(first.page[0].newDisplay).toBe("C");

    const second = await as.query(api.memberKit.getMemberKitHistory, {
      userId: memberId,
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(second.page[0].newDisplay).toBe("A");
  });
});

describe("moving items between scopes", () => {
  it("preserves entries, writes no entry history, and leaves old rows alone", async () => {
    const { as, memberId } = await setup();
    const setId = await as.mutation(api.memberKitAdmin.createSet, { name: "Comms" });
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      setId,
      name: "Pager",
      tracks: "serial",
    });
    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "EM-1" });

    const before = await as.query(api.memberKit.getMemberKitHistory, {
      userId: memberId,
      paginationOpts: { numItems: 50, cursor: null },
    });

    await as.mutation(api.memberKitAdmin.moveItem, { itemId, setId: null });

    const summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
    expect(summary?.standalone.entries[0]).toMatchObject({ itemName: "Pager", display: "EM-1" });
    expect(summary?.sets[0].entries).toEqual([]);

    const after = await as.query(api.memberKit.getMemberKitHistory, {
      userId: memberId,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(after.page).toHaveLength(before.page.length);
    // The row written before the move still reads with the set it was in.
    expect(after.page[0].setName).toBe("Comms");

    // …and back again.
    await as.mutation(api.memberKitAdmin.moveItem, { itemId, setId });
    const back = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
    expect(back?.sets[0].entries[0].display).toBe("EM-1");
    expect(back?.standalone.entries).toEqual([]);
  });

  it("is the escape hatch before deleting a set", async () => {
    const { as, memberId } = await setup();
    const setId = await as.mutation(api.memberKitAdmin.createSet, { name: "Comms" });
    const keep = await as.mutation(api.memberKitAdmin.createItem, {
      setId,
      name: "Pager",
      tracks: "serial",
    });
    const drop = await as.mutation(api.memberKitAdmin.createItem, {
      setId,
      name: "Radio",
      tracks: "serial",
    });
    await as.mutation(api.memberKit.setKitEntries, {
      userId: memberId,
      setId,
      entries: [
        { itemId: keep, value: "EM-1" },
        { itemId: drop, value: "R-1" },
      ],
    });

    await as.mutation(api.memberKitAdmin.moveItem, { itemId: keep, setId: null });
    await as.mutation(api.memberKitAdmin.deleteSet, { setId });

    const summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
    expect(summary?.sets).toEqual([]);
    expect(summary?.standalone.entries).toHaveLength(1);
    expect(summary?.standalone.entries[0].display).toBe("EM-1");
  });
});

describe("definition guards", () => {
  it("locks what an item tracks once a value exists", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });
    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "EM-1" });

    await expect(
      as.mutation(api.memberKitAdmin.updateItem, { itemId, tracks: "note" }),
    ).rejects.toThrow(/cannot be changed/);
  });

  it("blocks removing an option a member is recorded against", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Helmet",
      tracks: "choice",
      options: ["Yellow", "White"],
    });
    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "Yellow" });

    await expect(
      as.mutation(api.memberKitAdmin.updateItem, { itemId, options: ["White"] }),
    ).rejects.toThrow(/still recorded against members: Yellow/);
  });

  it("blocks removing a size a member is recorded against", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Jacket",
      tracks: "size",
    });
    const chartId = await as.mutation(api.memberKitAdmin.createChart, {
      itemId,
      name: "Supplier A",
      sizes: ["87", "92"],
    });
    await as.mutation(api.memberKit.setKitEntry, {
      userId: memberId,
      itemId,
      value: { chartId, size: "92" },
    });

    await expect(
      as.mutation(api.memberKitAdmin.updateChart, { chartId, sizes: ["87"] }),
    ).rejects.toThrow(/still recorded against members: 92/);
  });

  it("records a size against an unnamed chart, with no brand in the display", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Braces",
      tracks: "size",
    });
    // Braces only ever come in one make, so the officer names nothing.
    const chartId = await as.mutation(api.memberKitAdmin.createChart, {
      itemId,
      sizes: ["Small", "Medium", "Large"],
    });

    await as.mutation(api.memberKit.setKitEntry, {
      userId: memberId,
      itemId,
      value: { chartId, size: "Medium" },
    });

    const summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
    expect(summary?.standalone.entries[0].display).toBe("Medium");

    const history = await as.query(api.memberKit.getMemberKitHistory, {
      userId: memberId,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(history.page[0].newDisplay).toBe("Medium");
  });

  it("treats a blank chart name the same as omitting it", async () => {
    const { as } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Braces",
      tracks: "size",
    });
    await as.mutation(api.memberKitAdmin.createChart, { itemId, name: "  ", sizes: ["M"] });

    const defs = await as.query(api.memberKit.getKitDefinitions, {});
    expect(defs.standalone[0].charts[0].name).toBeUndefined();
  });

  it("requires a name once an item has more than one chart", async () => {
    const { as } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Gloves",
      tracks: "size",
    });
    const first = await as.mutation(api.memberKitAdmin.createChart, {
      itemId,
      sizes: ["9"],
    });

    // A second chart alongside an unnamed one would be indistinguishable.
    await expect(
      as.mutation(api.memberKitAdmin.createChart, { itemId, name: "Supplier B", sizes: ["10"] }),
    ).rejects.toThrow(/unnamed/);

    await as.mutation(api.memberKitAdmin.updateChart, { chartId: first, name: "Supplier A" });
    const second = await as.mutation(api.memberKitAdmin.createChart, {
      itemId,
      name: "Supplier B",
      sizes: ["10"],
    });
    expect(second).toBeDefined();

    // …and now neither one may drop its name.
    await expect(
      as.mutation(api.memberKitAdmin.updateChart, { chartId: first, name: "" }),
    ).rejects.toThrow(/needs a name/);
  });

  it("refuses a second unnamed chart", async () => {
    const { as } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Gloves",
      tracks: "size",
    });
    await as.mutation(api.memberKitAdmin.createChart, { itemId, name: "Supplier A", sizes: ["9"] });

    await expect(
      as.mutation(api.memberKitAdmin.createChart, { itemId, sizes: ["10"] }),
    ).rejects.toThrow(/needs a brand or model name/);
  });

  it("refuses charts on an item that is not sized", async () => {
    const { as } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });
    await expect(
      as.mutation(api.memberKitAdmin.createChart, { itemId, name: "Supplier A", sizes: ["1"] }),
    ).rejects.toThrow(/not a sized item/);
  });

  it("archiving and restoring keeps entries and writes no entry history", async () => {
    const { as, memberId } = await setup();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });
    await as.mutation(api.memberKit.setKitEntry, { userId: memberId, itemId, value: "EM-1" });

    await as.mutation(api.memberKitAdmin.updateItem, { itemId, isArchived: true });
    let summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
    expect(summary?.itemCount).toBe(0);

    await as.mutation(api.memberKitAdmin.updateItem, { itemId, isArchived: false });
    summary = await as.query(api.memberKit.getMemberKitSummary, { userId: memberId });
    expect(summary?.standalone.entries[0].display).toBe("EM-1");

    const history = await as.query(api.memberKit.getMemberKitHistory, {
      userId: memberId,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(history.page).toHaveLength(1); // only the original edit
  });
});

describe("access gates", () => {
  it("denies both gates to a member below the minimum rank", async () => {
    const t = convexTest(schema, modules);
    const memberId = await t.run(async (ctx) => {
      const updatedAt = Date.now();
      for (const moduleId of ["memberRecords", "memberRecordsAdmin"]) {
        await ctx.db.insert("moduleSettings", {
          moduleId,
          moduleName: moduleId,
          isEnabled: true,
          adminOnly: false,
          requiredRoles: [],
          minimumRank: "Lieutenant",
          updatedAt,
        });
      }
      return ctx.db.insert("users", { name: "Jo", rank: "Firefighter" as const });
    });

    const asMember = t.withIdentity({ subject: memberId });
    await expect(asMember.query(api.memberKit.listMembers, {})).rejects.toThrow(
      /do not have access/,
    );
    await expect(
      asMember.mutation(api.memberKitAdmin.createSet, { name: "X" }),
    ).rejects.toThrow(/do not have access/);
  });

  it("lets a recorder record but not define kit", async () => {
    const t = convexTest(schema, modules);
    const { officerId, memberId } = await t.run(async (ctx) => {
      const updatedAt = Date.now();
      await ctx.db.insert("moduleSettings", {
        moduleId: "memberRecords",
        moduleName: "memberRecords",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant",
        updatedAt,
      });
      // Admin-only: the recorder gate is open, the definition gate is not.
      await ctx.db.insert("moduleSettings", {
        moduleId: "memberRecordsAdmin",
        moduleName: "memberRecordsAdmin",
        isEnabled: true,
        adminOnly: true,
        requiredRoles: [],
        updatedAt,
      });
      const officerId = await ctx.db.insert("users", {
        name: "Max",
        rank: "Lieutenant" as const,
      });
      const memberId = await ctx.db.insert("users", { name: "Jo", rank: "Firefighter" as const });
      return { officerId, memberId };
    });

    const asOfficer = t.withIdentity({ subject: officerId });
    await expect(asOfficer.query(api.memberKit.listMembers, {})).resolves.toBeDefined();
    await expect(
      asOfficer.query(api.memberKit.getMemberKitSummary, { userId: memberId }),
    ).resolves.toBeDefined();
    await expect(
      asOfficer.mutation(api.memberKitAdmin.createItem, { name: "Pager", tracks: "serial" }),
    ).rejects.toThrow(/do not have access/);
  });

  it("denies an anonymous caller outright", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.memberKit.listMembers, {})).rejects.toThrow(/signed in/);
  });
});

describe("shared accounts", () => {
  /** Adds a shared (non-member) login alongside the normal fixture members. */
  async function withSharedAccount() {
    const ctx = await setup();
    const sharedId = await ctx.t.run(async (db) =>
      db.db.insert("users", {
        name: "Duty Officer Phone",
        firstName: "Duty Officer",
        lastName: "Phone",
        rank: "Firefighter" as const,
        accountType: "shared" as const,
      }),
    );
    return { ...ctx, sharedId };
  }

  it("omits a shared account from the members list", async () => {
    const { as, memberId, sharedId } = await withSharedAccount();

    const members = await as.query(api.memberKit.listMembers, {});
    const ids = members.map((m) => m._id);

    expect(ids).toContain(memberId);
    expect(ids).not.toContain(sharedId);
  });

  it("omits a shared account from the bulk fill-in screen", async () => {
    const { as, memberId, sharedId } = await withSharedAccount();
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      name: "Pager",
      tracks: "serial",
    });

    const result = await as.query(api.memberKit.getItemEntriesForAllMembers, { itemId });
    const ids = result?.members.map((m) => m.userId) ?? [];

    expect(ids).toContain(memberId);
    expect(ids).not.toContain(sharedId);
  });

  it("returns null for a shared account's kit summary, closing the deep-link", async () => {
    const { as, sharedId } = await withSharedAccount();

    await expect(
      as.query(api.memberKit.getMemberKitSummary, { userId: sharedId }),
    ).resolves.toBeNull();
  });

  it("refuses to record kit against a shared account", async () => {
    const { as, sharedId } = await withSharedAccount();
    const setId = await as.mutation(api.memberKitAdmin.createSet, { name: "Structural PPC" });
    const itemId = await as.mutation(api.memberKitAdmin.createItem, {
      setId,
      name: "Boots",
      tracks: "serial",
    });

    await expect(
      as.mutation(api.memberKit.setKitEntries, {
        userId: sharedId,
        setId,
        entries: [{ itemId, value: "BX-1" }],
      }),
    ).rejects.toThrow(/Member not found/);

    await expect(
      as.mutation(api.memberKit.setKitEntry, { userId: sharedId, itemId, value: "BX-1" }),
    ).rejects.toThrow(/Member not found/);

    await expect(
      as.mutation(api.memberKit.setKitItemEntries, {
        itemId,
        entries: [{ userId: sharedId, value: "BX-1" }],
      }),
    ).rejects.toThrow(/Member not found/);
  });

  it("treats a user with no accountType exactly as before (no-backfill guarantee)", async () => {
    const { as, memberId, otherMemberId } = await withSharedAccount();

    const members = await as.query(api.memberKit.listMembers, {});
    const ids = members.map((m) => m._id);

    expect(ids).toContain(memberId);
    expect(ids).toContain(otherMemberId);
    await expect(
      as.query(api.memberKit.getMemberKitSummary, { userId: memberId }),
    ).resolves.not.toBeNull();
  });
});
