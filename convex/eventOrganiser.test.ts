// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const FUTURE = "2099-06-01";

/**
 * `admin` is the creating organiser. `alice` and `bob` are ordinary members
 * with no eventsAdmin access, so they stand in for both "the handover target"
 * and "someone who must not be able to reassign".
 */
async function setup() {
  const t = convexTest(schema, modules);

  const { adminId, aliceId, bobId, tabletId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Org Aniser",
      firstName: "Org",
      lastName: "Aniser",
      rank: "Captain" as const,
      isAdmin: true,
    });
    const aliceId = await ctx.db.insert("users", {
      name: "Alice Ash",
      firstName: "Alice",
      rank: "Firefighter" as const,
    });
    const bobId = await ctx.db.insert("users", {
      name: "Bob Birch",
      firstName: "Bob",
      rank: "Firefighter" as const,
    });
    const tabletId = await ctx.db.insert("users", {
      name: "Truck tablet",
      accountType: "shared" as const,
    });

    await ctx.db.insert("moduleSettings", {
      moduleId: "events",
      moduleName: "Events",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      updatedAt: Date.now(),
    });

    return { adminId, aliceId, bobId, tabletId };
  });

  const asAdmin = t.withIdentity({ subject: adminId });
  const eventId = await asAdmin.mutation(api.events.createEvent, {
    title: "Bunnings sausage sizzle",
    startDate: FUTURE,
    isAllDay: true,
  });

  const organiserOf = async () =>
    (await t.run(async (ctx) => ctx.db.get(eventId)))?.createdBy;

  const handoverHistory = async () =>
    (
      await t.run(async (ctx) =>
        ctx.db
          .query("eventHistory")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect(),
      )
    ).filter((entry) => entry.changeType === "organiser_change");

  return {
    t,
    eventId,
    adminId,
    aliceId,
    bobId,
    tabletId,
    organiserOf,
    handoverHistory,
    asAdmin,
    asAlice: t.withIdentity({ subject: aliceId }),
    asBob: t.withIdentity({ subject: bobId }),
  };
}

describe("changeOrganiser", () => {
  it("hands the event to another member and records the change", async () => {
    const { asAdmin, eventId, adminId, aliceId, organiserOf, handoverHistory } =
      await setup();

    await asAdmin.mutation(api.events.changeOrganiser, {
      eventId,
      organiserId: aliceId,
    });

    expect(await organiserOf()).toBe(aliceId);

    const history = await handoverHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      field: "organiser",
      oldValue: adminId,
      newValue: aliceId,
      userId: adminId,
    });
  });

  it("lets the current organiser hand over even without eventsAdmin", async () => {
    const { asAdmin, asAlice, eventId, aliceId, bobId, organiserOf } = await setup();

    // Alice is a plain Firefighter: no eventsAdmin, but now owns the event
    await asAdmin.mutation(api.events.changeOrganiser, { eventId, organiserId: aliceId });
    await asAlice.mutation(api.events.changeOrganiser, { eventId, organiserId: bobId });

    expect(await organiserOf()).toBe(bobId);
  });

  it("refuses a member who is neither the organiser nor an events admin", async () => {
    const { asBob, eventId, aliceId } = await setup();

    await expect(
      asBob.mutation(api.events.changeOrganiser, { eventId, organiserId: aliceId }),
    ).rejects.toThrow(/do not have access/i);
  });

  it("refuses a shared account, which has nobody accountable behind it", async () => {
    const { asAdmin, eventId, adminId, tabletId, organiserOf } = await setup();

    await expect(
      asAdmin.mutation(api.events.changeOrganiser, { eventId, organiserId: tabletId }),
    ).rejects.toThrow(/shared account/i);
    expect(await organiserOf()).toBe(adminId);
  });

  it("is a no-op when the organiser is unchanged", async () => {
    const { asAdmin, eventId, adminId, handoverHistory } = await setup();

    await asAdmin.mutation(api.events.changeOrganiser, {
      eventId,
      organiserId: adminId,
    });

    expect(await handoverHistory()).toHaveLength(0);
  });

  it("refuses an organiser id that no longer exists", async () => {
    const { t, asAdmin, eventId, aliceId } = await setup();
    await t.run(async (ctx) => ctx.db.delete(aliceId));

    await expect(
      asAdmin.mutation(api.events.changeOrganiser, { eventId, organiserId: aliceId }),
    ).rejects.toThrow(/no longer exists/i);
  });
});
