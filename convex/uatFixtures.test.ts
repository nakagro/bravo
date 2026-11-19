// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("users", { name: "Org Aniser", firstName: "Org", lastName: "Aniser", isAdmin: true });
    for (let i = 0; i < 12; i++) {
      await ctx.db.insert("users", { name: `Alex Carter ${i}`, firstName: "Alex", lastName: `Carter ${i}` });
    }
  });
  return t;
}

describe("UAT test event", () => {
  const original = process.env.CONVEX_CLOUD_URL;
  afterEach(() => {
    process.env.CONVEX_CLOUD_URL = original;
  });

  it("refuses on any deployment that isn't UAT", async () => {
    const t = await setup();
    process.env.CONVEX_CLOUD_URL = "https://boss-convex.grayhux.io";
    await expect(t.mutation(internal.uatFixtures.createTestEvent, {})).rejects.toThrow("not the UAT");
    expect(await t.run((ctx) => ctx.db.query("events").collect())).toEqual([]);
  });

  it("makes a lived-in shift event on UAT", async () => {
    const t = await setup();
    process.env.CONVEX_CLOUD_URL = "https://precious-magpie-647.convex.cloud";
    const { eventId, title, people } = await t.mutation(internal.uatFixtures.createTestEvent, {});
    expect(title).toBe("[TEST] Station crewing day");
    expect(people).toBe(12);

    const counts = await t.run(async (ctx) => {
      const byEvent = { eventId } as const;
      const all = async <T extends { eventId: unknown }>(rows: Promise<T[]>) =>
        (await rows).filter((r) => r.eventId === byEvent.eventId);
      const rsvps = await all(ctx.db.query("eventRsvps").collect());
      const crews = await all(ctx.db.query("eventCrews").collect());
      return {
        slots: (await all(ctx.db.query("eventSlots").collect())).length,
        statuses: new Set(rsvps.map((r) => r.status)).size,
        interest: (await all(ctx.db.query("eventSlotResponses").collect())).length,
        rostered: (await all(ctx.db.query("eventSlotAllocations").collect())).length,
        perShiftCrew: crews[0]?.perShift,
      };
    });
    expect(counts.slots).toBe(3);
    expect(counts.statuses).toBe(3);
    expect(counts.interest).toBeGreaterThan(10);
    expect(counts.rostered).toBeGreaterThan(0);
    expect(counts.perShiftCrew).toBe(true);
  });
});
