// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const FUTURE = "2099-06-01";
const PAST = "2020-01-15";

async function setup() {
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    const organiserId = await ctx.db.insert("users", {
      name: "Org Aniser",
      firstName: "Org",
      lastName: "Aniser",
      rank: "Captain" as const,
      isAdmin: true,
    });
    const otherAdminId = await ctx.db.insert("users", {
      name: "Other Officer",
      firstName: "Other",
      lastName: "Officer",
      rank: "Lieutenant" as const,
    });
    const aliceId = await ctx.db.insert("users", {
      name: "Alice Ash",
      firstName: "Alice",
      lastName: "Ash",
      rank: "Firefighter" as const,
    });
    const bobId = await ctx.db.insert("users", {
      name: "Bob Birch",
      firstName: "Bob",
      lastName: "Birch",
      rank: "Firefighter" as const,
    });
    const carolId = await ctx.db.insert("users", {
      name: "Carol Cedar",
      firstName: "Carol",
      lastName: "Cedar",
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
    await ctx.db.insert("moduleSettings", {
      moduleId: "eventsAdmin",
      moduleName: "Events Admin",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      minimumRank: "Lieutenant" as const,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("moduleSettings", {
      moduleId: "actions",
      moduleName: "Action Centre",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      updatedAt: Date.now(),
    });

    return { organiserId, otherAdminId, aliceId, bobId, carolId, tabletId };
  });

  return {
    t,
    ...ids,
    asOrganiser: t.withIdentity({ subject: ids.organiserId }),
    asOtherAdmin: t.withIdentity({ subject: ids.otherAdminId }),
    asAlice: t.withIdentity({ subject: ids.aliceId }),
    asBob: t.withIdentity({ subject: ids.bobId }),
    asCarol: t.withIdentity({ subject: ids.carolId }),
  };
}

describe("private events visibility", () => {
  it("hides private events from uninvited members while showing them to invited, leaders and Events Admins", async () => {
    const {
      asOrganiser,
      asOtherAdmin,
      asAlice,
      asBob,
      asCarol,
      aliceId,
      carolId,
    } = await setup();

    const eventId = await asOrganiser.mutation(api.events.createEvent, {
      title: "BMT Planning",
      startDate: FUTURE,
      isAllDay: true,
      hasShifts: true,
      slots: [{ label: "Session 1" }],
      crewAppliances: ["Tanker 1"],
      isPrivate: true,
      invitedUserIds: [aliceId],
    });

    await asOrganiser.mutation(api.events.setTeamLeaders, {
      eventId,
      userIds: [carolId],
    });

    // Uninvited member (Bob) sees nothing anywhere
    expect(
      await asBob.query(api.events.getUpcomingEvents, { fromDate: "2099-01-01" })
    ).toEqual([]);
    expect(await asBob.query(api.events.getEvent, { eventId })).toBeNull();
    expect(await asBob.query(api.events.getEventAttendance, { eventId })).toBeNull();
    expect(await asBob.query(api.events.getConfirmedAttendance, { eventId })).toBeNull();
    expect(await asBob.query(api.events.getEventSlots, { eventId })).toEqual([]);
    expect(await asBob.query(api.eventCrews.listEventCrews, { eventId })).toEqual([]);
    expect(await asBob.query(api.eventCrews.listShiftCrews, { eventId })).toEqual([]);

    // Invited member (Alice) sees the event and who else is invited
    const forAlice = await asAlice.query(api.events.getEvent, { eventId });
    expect(forAlice).toMatchObject({
      title: "BMT Planning",
      isPrivate: true,
      iAmInvited: true,
      invitedCount: 3, // organiser + carol (team leader) + alice
    });
    const aliceAttendance = await asAlice.query(api.events.getEventAttendance, { eventId });
    expect(aliceAttendance?.invited.map((m) => m.firstName).sort()).toEqual([
      "Alice",
      "Carol",
      "Org",
    ]);
    expect(aliceAttendance?.breakdown).toBeNull();
    expect(await asAlice.query(api.events.getEventSlots, { eventId })).toHaveLength(1);
    expect(await asAlice.query(api.eventCrews.listEventCrews, { eventId })).toHaveLength(1);

    // Team leader (Carol) sees it and is considered invited
    expect(await asCarol.query(api.events.getEvent, { eventId })).toMatchObject({
      isPrivate: true,
      iAmInvited: true,
      canManage: true,
    });

    // Uninvited Events Admin (Other Officer) can see and manage, with iAmInvited = false
    expect(await asOtherAdmin.query(api.events.getEvent, { eventId })).toMatchObject({
      isPrivate: true,
      iAmInvited: false,
      canManage: true,
    });
    expect(
      await asOtherAdmin.query(api.events.getUpcomingEvents, { fromDate: "2099-01-01" })
    ).toHaveLength(1);
  });

  it("filters private events out of past event lists for uninvited members", async () => {
    const { asOrganiser, asAlice, asBob, aliceId } = await setup();

    await asOrganiser.mutation(api.events.createEvent, {
      title: "Private Past Meeting",
      startDate: PAST,
      isAllDay: true,
      isPrivate: true,
      invitedUserIds: [aliceId],
    });
    await asOrganiser.mutation(api.events.createEvent, {
      title: "Public Past Event",
      startDate: PAST,
      isAllDay: true,
    });

    const forAlice = await asAlice.query(api.events.getPastEvents, { beforeDate: "2099-01-01" });
    expect(forAlice.map((e) => e.title).sort()).toEqual([
      "Private Past Meeting",
      "Public Past Event",
    ]);

    const forBob = await asBob.query(api.events.getPastEvents, { beforeDate: "2099-01-01" });
    expect(forBob.map((e) => e.title)).toEqual(["Public Past Event"]);
  });
});

describe("private event responses, breakdown and mutations", () => {
  it("scopes the manager breakdown to the invited pool and blocks uninvited RSVPs", async () => {
    const { asOrganiser, asOtherAdmin, asAlice, asBob, aliceId } = await setup();

    const eventId = await asOrganiser.mutation(api.events.createEvent, {
      title: "Private Dinner",
      startDate: FUTURE,
      isAllDay: true,
      isPrivate: true,
      invitedUserIds: [aliceId],
    });

    // Uninvited Firefighter and uninvited Events Admin cannot RSVP
    await expect(
      asBob.mutation(api.events.setRsvp, { eventId, status: "attending" })
    ).rejects.toThrow(/not invited/i);
    await expect(
      asOtherAdmin.mutation(api.events.setRsvp, { eventId, status: "attending" })
    ).rejects.toThrow(/not invited/i);

    // Invited Alice can RSVP
    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });

    // Breakdown totalMembers is 2 (organiser + alice), NOT all 5 brigade members
    const attendance = await asOrganiser.query(api.events.getEventAttendance, { eventId });
    expect(attendance?.attending.map((m) => m.firstName)).toEqual(["Alice"]);
    expect(attendance?.breakdown?.totalMembers).toBe(2);
    expect(attendance?.breakdown?.noResponse.map((m) => m.firstName)).toEqual(["Org"]);
  });

  it("toggles privacy non-destructively and records audit history", async () => {
    const { t, asOrganiser, asAlice, asBob, aliceId, tabletId } = await setup();

    const eventId = await asOrganiser.mutation(api.events.createEvent, {
      title: "Brigade BBQ",
      startDate: FUTURE,
      isAllDay: true,
    });

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });
    await asBob.mutation(api.events.setRsvp, { eventId, status: "attending" });

    // Non-manager cannot change privacy
    await expect(
      asAlice.mutation(api.events.setEventPrivacy, {
        eventId,
        isPrivate: true,
        invitedUserIds: [aliceId],
      })
    ).rejects.toThrow(/do not have access/i);

    // Shared accounts are rejected
    await expect(
      asOrganiser.mutation(api.events.setEventPrivacy, {
        eventId,
        isPrivate: true,
        invitedUserIds: [tabletId],
      })
    ).rejects.toThrow(/shared account/i);

    // Make private with only Alice invited -> Bob disappears from counts & access
    await asOrganiser.mutation(api.events.setEventPrivacy, {
      eventId,
      isPrivate: true,
      invitedUserIds: [aliceId],
    });

    expect(await asBob.query(api.events.getEvent, { eventId })).toBeNull();
    const whilePrivate = await asOrganiser.query(api.events.getEventAttendance, { eventId });
    expect(whilePrivate?.attending.map((m) => m.firstName)).toEqual(["Alice"]);
    expect(whilePrivate?.breakdown?.totalMembers).toBe(2);

    // Clearing invitedUserIds while private still keeps the event private
    await asOrganiser.mutation(api.events.setEventPrivacy, {
      eventId,
      isPrivate: true,
      invitedUserIds: [],
    });
    expect(await asAlice.query(api.events.getEvent, { eventId })).toBeNull();

    // Opening back to the whole brigade brings Alice & Bob's RSVPs back untouched
    await asOrganiser.mutation(api.events.setEventPrivacy, {
      eventId,
      isPrivate: false,
    });
    const afterReopen = await asOrganiser.query(api.events.getEventAttendance, { eventId });
    expect(afterReopen?.attending.map((m) => m.firstName).sort()).toEqual(["Alice", "Bob"]);

    const history = (
      await t.run(async (ctx) =>
        ctx.db
          .query("eventHistory")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect()
      )
    ).filter((h) => h.changeType === "privacy_change");
    expect(history).toHaveLength(3);
  });

  it("auto-invites a member when rostered or seated on an appliance for a private event", async () => {
    const { asOrganiser, asBob, asCarol, bobId, carolId } = await setup();

    const eventId = await asOrganiser.mutation(api.events.createEvent, {
      title: "Private Strike Team Prep",
      startDate: FUTURE,
      isAllDay: true,
      isPrivate: true,
      invitedUserIds: [],
    });

    expect(await asBob.query(api.events.getEvent, { eventId })).toBeNull();
    expect(await asCarol.query(api.events.getEvent, { eventId })).toBeNull();

    // Roster Bob -> automatically invited
    await asOrganiser.mutation(api.events.toggleEventAllocation, {
      eventId,
      userId: bobId,
    });
    expect(await asBob.query(api.events.getEvent, { eventId })).toMatchObject({
      iAmInvited: true,
      iAmRostered: true,
    });

    // Seat Carol on an appliance -> automatically invited
    await asOrganiser.mutation(api.eventCrews.saveEventCrew, {
      eventId,
      applianceName: "Tanker 1",
      driver: { userId: carolId },
      crewMembers: [],
    });
    expect(await asCarol.query(api.events.getEvent, { eventId })).toMatchObject({
      iAmInvited: true,
    });
  });
});

describe("private event notifications and Action Centre", () => {
  it("scopes Action Centre RSVP prompts to invited members only", async () => {
    const { asOrganiser, asOtherAdmin, asAlice, asBob, aliceId } = await setup();

    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const eventId = await asOrganiser.mutation(api.events.createEvent, {
      title: "Committee Catchup",
      startDate: soon,
      isAllDay: true,
      isPrivate: true,
      invitedUserIds: [aliceId],
    });

    const aliceActions = await asAlice.query(api.actionCentre.getMyActions, {});
    expect(aliceActions.some((a) => a.id === `events:rsvp:${eventId}`)).toBe(true);

    // Uninvited member (Bob) and uninvited Events Admin do NOT get an RSVP prompt
    const bobActions = await asBob.query(api.actionCentre.getMyActions, {});
    expect(bobActions.some((a) => a.id === `events:rsvp:${eventId}`)).toBe(false);

    const adminActions = await asOtherAdmin.query(api.actionCentre.getMyActions, {});
    expect(adminActions.some((a) => a.id === `events:rsvp:${eventId}`)).toBe(false);
  });

  it("scopes 'everyone' event messages to invited members on private events", async () => {
    const { asOrganiser, aliceId, organiserId } = await setup();

    const eventId = await asOrganiser.mutation(api.events.createEvent, {
      title: "Private Briefing",
      startDate: FUTURE,
      isAllDay: true,
      isPrivate: true,
      invitedUserIds: [aliceId],
    });

    const preview = await asOrganiser.query(api.eventChangeNotices.previewEventChangeNotice, {
      eventId,
      kind: "message",
      audience: "everyone",
      message: "Bring notebooks",
    });

    expect(preview).not.toBeNull();
    expect(preview!.recipients.map((r) => r.userId).sort()).toEqual(
      [aliceId, organiserId].sort()
    );
  });
});
