// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const FUTURE = "2099-06-01";

/**
 * A team leader is the whole point of this suite: `alice` is a plain
 * Firefighter with no eventsAdmin access anywhere, so anything she can do here
 * she can only do because she was named on this one event. `bob` is the
 * control - identical rank, not named, must stay locked out.
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
    hasShifts: true,
    slots: [{ label: "Morning" }, { label: "Afternoon" }],
  });

  const leadersOf = async () =>
    (await t.run(async (ctx) => ctx.db.get(eventId)))?.teamLeaderIds;

  return {
    t,
    eventId,
    adminId,
    aliceId,
    bobId,
    tabletId,
    leadersOf,
    asAdmin,
    asAlice: t.withIdentity({ subject: aliceId }),
    asBob: t.withIdentity({ subject: bobId }),
  };
}

describe("setTeamLeaders", () => {
  it("names leaders and records the change", async () => {
    const { asAdmin, eventId, adminId, aliceId, leadersOf, t } = await setup();

    await asAdmin.mutation(api.events.setTeamLeaders, {
      eventId,
      userIds: [aliceId],
    });

    expect(await leadersOf()).toEqual([aliceId]);

    const history = (
      await t.run(async (ctx) =>
        ctx.db
          .query("eventHistory")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect(),
      )
    ).filter((entry) => entry.changeType === "team_leaders_change");
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      field: "teamLeaders",
      oldValue: [],
      newValue: [aliceId],
      userId: adminId,
    });
  });

  it("drops the organiser from their own leader list", async () => {
    const { asAdmin, eventId, adminId, aliceId, leadersOf } = await setup();

    await asAdmin.mutation(api.events.setTeamLeaders, {
      eventId,
      userIds: [adminId, aliceId, aliceId],
    });

    expect(await leadersOf()).toEqual([aliceId]);
  });

  it("refuses a shared account, which has nobody accountable behind it", async () => {
    const { asAdmin, eventId, tabletId, leadersOf } = await setup();

    await expect(
      asAdmin.mutation(api.events.setTeamLeaders, {
        eventId,
        userIds: [tabletId],
      }),
    ).rejects.toThrow(/shared account/i);
    expect(await leadersOf()).toBeUndefined();
  });

  it("is never something a team leader can do for themselves", async () => {
    const { asAdmin, asAlice, eventId, aliceId, bobId, leadersOf } =
      await setup();

    await asAdmin.mutation(api.events.setTeamLeaders, {
      eventId,
      userIds: [aliceId],
    });

    // Alice runs the event, but widening the role is not hers to do
    await expect(
      asAlice.mutation(api.events.setTeamLeaders, {
        eventId,
        userIds: [bobId],
      }),
    ).rejects.toThrow(/do not have access/i);
    expect(await leadersOf()).toEqual([aliceId]);
  });
});

describe("a team leader's scope", () => {
  async function withAliceLeading() {
    const fixture = await setup();
    await fixture.asAdmin.mutation(api.events.setTeamLeaders, {
      eventId: fixture.eventId,
      userIds: [fixture.aliceId],
    });
    return fixture;
  }

  it("can edit the event, roster shifts and close responses", async () => {
    const { asAlice, asAdmin, eventId, bobId, t } = await withAliceLeading();

    await asAlice.mutation(api.events.updateEvent, {
      eventId,
      location: "Bunnings car park",
    });

    const board = await asAdmin.query(api.events.getEventRoster, { eventId });
    const slotId = board!.slots[0]._id;

    await expect(
      asAlice.mutation(api.events.toggleSlotAllocation, {
        slotId,
        userId: bobId,
      }),
    ).resolves.toBe(true);

    await asAlice.mutation(api.events.setMemberResponses, {
      eventId,
      mode: "closed",
    });

    const event = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(event?.location).toBe("Bunnings car park");
    expect(event?.memberResponses).toBe("closed");
  });

  it("sees the full response breakdown, the history and the allocation board", async () => {
    const { asAlice, eventId } = await withAliceLeading();

    const attendance = await asAlice.query(api.events.getEventAttendance, {
      eventId,
    });
    expect(attendance?.breakdown).not.toBeNull();
    expect(
      await asAlice.query(api.events.getEventHistory, { eventId }),
    ).not.toHaveLength(0);
    expect(
      await asAlice.query(api.events.getEventRoster, { eventId }),
    ).not.toBeNull();
  });

  it("can cancel and restore, but not permanently delete", async () => {
    const { asAlice, eventId, t } = await withAliceLeading();

    await asAlice.mutation(api.events.cancelEvent, {
      eventId,
      reason: "Rained out",
    });
    expect((await t.run(async (ctx) => ctx.db.get(eventId)))?.status).toBe(
      "cancelled",
    );

    // Deletion is irreversible - running one event isn't a mandate to erase it
    await expect(
      asAlice.mutation(api.events.deleteEvent, { eventId }),
    ).rejects.toThrow(/do not have access/i);

    await asAlice.mutation(api.events.restoreEvent, { eventId });
    expect((await t.run(async (ctx) => ctx.db.get(eventId)))?.status).toBe(
      "active",
    );
  });

  it("gets no reach into any other event", async () => {
    const { asAlice, asAdmin } = await withAliceLeading();

    const otherId = await asAdmin.mutation(api.events.createEvent, {
      title: "Brigade AGM",
      startDate: FUTURE,
      isAllDay: true,
    });

    await expect(
      asAlice.mutation(api.events.updateEvent, {
        eventId: otherId,
        location: "Nope",
      }),
    ).rejects.toThrow(/do not have access/i);
    expect(
      (await asAlice.query(api.events.getEventAttendance, { eventId: otherId }))
        ?.breakdown,
    ).toBeNull();
    // Creating events stays brigade-wide eventsAdmin
    await expect(
      asAlice.mutation(api.events.createEvent, {
        title: "Alice's own event",
        startDate: FUTURE,
        isAllDay: true,
      }),
    ).rejects.toThrow(/do not have access/i);
  });

  it("locks an unnamed member of the same rank out of all of it", async () => {
    const { asBob, eventId } = await withAliceLeading();

    await expect(
      asBob.mutation(api.events.updateEvent, { eventId, location: "Nope" }),
    ).rejects.toThrow(/do not have access/i);
    expect(
      (await asBob.query(api.events.getEventAttendance, { eventId }))
        ?.breakdown,
    ).toBeNull();
    expect(
      await asBob.query(api.events.getEventRoster, { eventId }),
    ).toBeNull();
  });

  it("shows up as canManage on the event the leader runs, and only there", async () => {
    const { asAlice, asAdmin, asBob, eventId } = await withAliceLeading();

    const otherId = await asAdmin.mutation(api.events.createEvent, {
      title: "Brigade AGM",
      startDate: FUTURE,
      isAllDay: true,
    });

    const mine = await asAlice.query(api.events.getEvent, { eventId });
    expect(mine).toMatchObject({
      canManage: true,
      iAmTeamLeader: true,
      // Appointing and deleting stay above her
      canAppointLeaders: false,
      canDelete: false,
    });
    expect(mine?.teamLeaders.map((leader) => leader.firstName)).toEqual([
      "Alice",
    ]);

    expect(
      await asAlice.query(api.events.getEvent, { eventId: otherId }),
    ).toMatchObject({
      canManage: false,
      iAmTeamLeader: false,
    });
    expect(await asBob.query(api.events.getEvent, { eventId })).toMatchObject({
      canManage: false,
      iAmTeamLeader: false,
    });
  });
});

describe("an organiser without eventsAdmin", () => {
  it("can manage the event they were handed", async () => {
    const { asAdmin, asAlice, eventId, aliceId, t } = await setup();

    await asAdmin.mutation(api.events.changeOrganiser, {
      eventId,
      organiserId: aliceId,
    });

    await asAlice.mutation(api.events.updateEvent, {
      eventId,
      location: "Bunnings car park",
    });
    expect((await t.run(async (ctx) => ctx.db.get(eventId)))?.location).toBe(
      "Bunnings car park",
    );

    // And, unlike a team leader, can name leaders of their own
    await asAlice.mutation(api.events.setTeamLeaders, { eventId, userIds: [] });
    expect(await asAlice.query(api.events.getEvent, { eventId })).toMatchObject(
      {
        canManage: true,
        canAppointLeaders: true,
        canDelete: false,
      },
    );
  });
});
