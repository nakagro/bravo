// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// The date doesn't matter to the backend - confirming is allowed whenever the
// organiser gets to it; only the UI waits for the event to have started.
const EVENT_DATE = "2099-06-01";

/**
 * `alice` said yes, `bob` said no, `carol` never answered. That spread is the
 * point: confirmed attendance has to be free to disagree with every one of
 * them, because on the day it does.
 */
async function setup() {
  const t = convexTest(schema, modules);

  const { adminId, aliceId, bobId, carolId, tabletId } = await t.run(async (ctx) => {
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
    const carolId = await ctx.db.insert("users", {
      name: "Carol Cedar",
      firstName: "Carol",
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

    return { adminId, aliceId, bobId, carolId, tabletId };
  });

  const asAdmin = t.withIdentity({ subject: adminId });
  const eventId = await asAdmin.mutation(api.events.createEvent, {
    title: "School visit",
    startDate: EVENT_DATE,
    isAllDay: true,
  });

  const asAlice = t.withIdentity({ subject: aliceId });
  const asBob = t.withIdentity({ subject: bobId });
  await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });
  await asBob.mutation(api.events.setRsvp, { eventId, status: "notAttending" });

  return {
    t,
    eventId,
    adminId,
    aliceId,
    bobId,
    carolId,
    tabletId,
    asAdmin,
    asAlice,
    asBob,
    asCarol: t.withIdentity({ subject: carolId }),
  };
}

describe("setEventAttendance", () => {
  it("records who turned up, whatever they said beforehand", async () => {
    const { asAdmin, eventId, adminId, bobId, carolId, aliceId } = await setup();

    // Bob said no and came anyway; Carol never answered and came; Alice said
    // yes and didn't show.
    await asAdmin.mutation(api.events.setEventAttendance, {
      eventId,
      userIds: [bobId, carolId],
    });

    const confirmed = await asAdmin.query(api.events.getConfirmedAttendance, { eventId });
    expect(confirmed?.attendees.map((m) => m._id).sort()).toEqual([bobId, carolId].sort());
    expect(confirmed?.confirmedBy?._id).toBe(adminId);
    expect(confirmed?.confirmedAt).toBeTypeOf("number");

    // The RSVPs are untouched - the prediction stays next to the outcome
    const event = await asAdmin.query(api.events.getEvent, { eventId });
    expect(event?.counts.attending).toBe(1);
    expect(event?.attendedCount).toBe(2);

    expect(confirmed?.deviation?.noShows.map((m) => m._id)).toEqual([aliceId]);
    expect(confirmed?.deviation?.unexpected.map((m) => m._id).sort()).toEqual(
      [bobId, carolId].sort(),
    );
  });

  it("replaces the stored list wholesale when amended", async () => {
    const { asAdmin, eventId, aliceId, carolId } = await setup();

    await asAdmin.mutation(api.events.setEventAttendance, { eventId, userIds: [aliceId] });
    await asAdmin.mutation(api.events.setEventAttendance, { eventId, userIds: [carolId] });

    const confirmed = await asAdmin.query(api.events.getConfirmedAttendance, { eventId });
    expect(confirmed?.attendees.map((m) => m._id)).toEqual([carolId]);
  });

  it("keeps shared accounts out of the record", async () => {
    const { asAdmin, eventId, tabletId, aliceId } = await setup();

    await asAdmin.mutation(api.events.setEventAttendance, {
      eventId,
      userIds: [aliceId, tabletId],
    });

    const confirmed = await asAdmin.query(api.events.getConfirmedAttendance, { eventId });
    expect(confirmed?.attendees.map((m) => m._id)).toEqual([aliceId]);
  });

  it("logs the confirmation, then the amendment, in the audit trail", async () => {
    const { asAdmin, t, eventId, aliceId, carolId, adminId } = await setup();

    await asAdmin.mutation(api.events.setEventAttendance, { eventId, userIds: [aliceId] });
    await asAdmin.mutation(api.events.setEventAttendance, {
      eventId,
      userIds: [aliceId, carolId],
    });

    const history = (
      await t.run(async (ctx) =>
        ctx.db
          .query("eventHistory")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect(),
      )
    ).filter((entry) => entry.field === "attendance");

    expect(history.map((entry) => entry.changeType)).toEqual([
      "attendance_confirmed",
      "attendance_amended",
    ]);
    expect(history[1]).toMatchObject({ oldValue: 1, newValue: 2, userId: adminId });
  });

  it("is not something an ordinary member can do", async () => {
    const { asAlice, eventId, aliceId } = await setup();

    await expect(
      asAlice.mutation(api.events.setEventAttendance, { eventId, userIds: [aliceId] }),
    ).rejects.toThrow(/access to manage events/i);
  });

  it("lets a team leader confirm the event they're running", async () => {
    const { asAdmin, asAlice, eventId, aliceId, carolId } = await setup();

    await asAdmin.mutation(api.events.setTeamLeaders, { eventId, userIds: [aliceId] });
    await asAlice.mutation(api.events.setEventAttendance, { eventId, userIds: [carolId] });

    const confirmed = await asAlice.query(api.events.getConfirmedAttendance, { eventId });
    expect(confirmed?.attendees.map((m) => m._id)).toEqual([carolId]);
  });
});

describe("getConfirmedAttendance", () => {
  it("reads as unconfirmed until someone confirms it", async () => {
    const { asAdmin, eventId } = await setup();

    const confirmed = await asAdmin.query(api.events.getConfirmedAttendance, { eventId });
    expect(confirmed?.confirmedAt).toBeNull();
    expect(confirmed?.attendees).toEqual([]);
    expect(confirmed?.deviation).toBeNull();

    const event = await asAdmin.query(api.events.getEvent, { eventId });
    expect(event?.attendedCount).toBeNull();
  });

  it("shows every member the list, but the deviation only to a manager", async () => {
    const { asAdmin, asCarol, eventId, carolId } = await setup();

    await asAdmin.mutation(api.events.setEventAttendance, { eventId, userIds: [carolId] });

    const asMember = await asCarol.query(api.events.getConfirmedAttendance, { eventId });
    expect(asMember?.attendees.map((m) => m._id)).toEqual([carolId]);
    expect(asMember?.canConfirm).toBe(false);
    // Who said yes and didn't show is the organiser's business, not the brigade's
    expect(asMember?.deviation).toBeNull();
  });

  it("on a rostered shift event, expects only the roster - not everyone who offered", async () => {
    const { asAdmin, asBob, asCarol, eventId, aliceId, bobId, carolId } = await setup();

    await asAdmin.mutation(api.events.updateEvent, {
      eventId,
      hasShifts: true,
      slots: [{ label: "Morning" }],
    });
    const [slot] = await asAdmin.query(api.events.getEventSlots, { eventId });

    // Carol offered and was never rostered; Alice was rostered
    await asCarol.mutation(api.events.toggleSlotResponse, { slotId: slot._id });

    // With no roster yet, an offer is all there is to go on
    const unrostered = await asAdmin.query(api.events.getAttendanceSheet, { eventId });
    expect(unrostered?.expectedIds).toEqual([carolId]);

    await asAdmin.mutation(api.events.toggleSlotAllocation, { slotId: slot._id, userId: aliceId });
    const sheet = await asAdmin.query(api.events.getAttendanceSheet, { eventId });
    expect(sheet?.expectedIds).toEqual([aliceId]);

    // Nobody came but Bob, who declined
    await asBob.mutation(api.events.setRsvp, { eventId, status: "notAttending" });
    await asAdmin.mutation(api.events.setEventAttendance, { eventId, userIds: [bobId] });

    const confirmed = await asAdmin.query(api.events.getConfirmedAttendance, { eventId });
    expect(confirmed?.deviation?.noShows.map((m) => m._id)).toEqual([aliceId]);
    expect(confirmed?.deviation?.unexpected.map((m) => m._id)).toEqual([bobId]);
  });

  it("doesn't call someone who offered and came an unexpected arrival", async () => {
    const { asAdmin, asCarol, eventId, aliceId, carolId } = await setup();

    await asAdmin.mutation(api.events.updateEvent, {
      eventId,
      hasShifts: true,
      slots: [{ label: "Morning" }],
    });
    const [slot] = await asAdmin.query(api.events.getEventSlots, { eventId });
    await asCarol.mutation(api.events.toggleSlotResponse, { slotId: slot._id });
    await asAdmin.mutation(api.events.toggleSlotAllocation, { slotId: slot._id, userId: aliceId });

    await asAdmin.mutation(api.events.setEventAttendance, {
      eventId,
      userIds: [aliceId, carolId],
    });

    const confirmed = await asAdmin.query(api.events.getConfirmedAttendance, { eventId });
    expect(confirmed?.deviation).toEqual({ noShows: [], unexpected: [] });
  });
});

describe("clearEventAttendance", () => {
  it("puts the event back to unconfirmed", async () => {
    const { asAdmin, eventId, aliceId, t } = await setup();

    await asAdmin.mutation(api.events.setEventAttendance, { eventId, userIds: [aliceId] });
    await asAdmin.mutation(api.events.clearEventAttendance, { eventId });

    const confirmed = await asAdmin.query(api.events.getConfirmedAttendance, { eventId });
    expect(confirmed?.confirmedAt).toBeNull();
    expect(confirmed?.attendees).toEqual([]);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("eventAttendance")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect(),
    );
    expect(rows).toEqual([]);
  });
});

describe("getAttendanceSheet", () => {
  it("prefills from whoever was expected", async () => {
    const { asAdmin, eventId, aliceId } = await setup();

    const sheet = await asAdmin.query(api.events.getAttendanceSheet, { eventId });
    expect(sheet?.expectedIds).toEqual([aliceId]);
    expect(sheet?.confirmedIds).toEqual([]);
    // Every member is tickable, not just the expected ones
    expect(sheet?.members.length).toBe(4);
  });

  it("is closed to members who can't run the event", async () => {
    const { asCarol, eventId } = await setup();

    expect(await asCarol.query(api.events.getAttendanceSheet, { eventId })).toBeNull();
  });
});
