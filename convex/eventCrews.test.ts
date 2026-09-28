// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const FUTURE = "2099-06-01";

// `admin` runs events brigade-wide; `alice` is a plain Firefighter who is
// named team leader on this one event; `bob` is the control, not named.
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
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
      lastName: "Ash",
      rank: "Firefighter" as const,
    });
    const bobId = await ctx.db.insert("users", {
      name: "Bob Birch",
      firstName: "Bob",
      lastName: "Birch",
      rank: "Firefighter" as const,
    });
    await ctx.db.insert("moduleSettings", {
      moduleId: "events",
      moduleName: "Events",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      updatedAt: Date.now(),
    });
    return { adminId, aliceId, bobId };
  });

  const asAdmin = t.withIdentity({ subject: ids.adminId });
  const eventId = await asAdmin.mutation(api.events.createEvent, {
    title: "School visit",
    startDate: FUTURE,
    isAllDay: true,
    crewAppliances: ["Wyndham Vale Pumper", " wyndham vale pumper ", "Wyndham Vale Tanker"],
  });
  await asAdmin.mutation(api.events.setTeamLeaders, { eventId, userIds: [ids.aliceId] });

  return {
    t,
    eventId,
    ...ids,
    asAdmin,
    asAlice: t.withIdentity({ subject: ids.aliceId }),
    asBob: t.withIdentity({ subject: ids.bobId }),
  };
}

describe("appliance crews on events", () => {
  it("creates one empty crew per appliance from the event form, ignoring duplicates", async () => {
    const { eventId, asBob } = await setup();
    const crews = await asBob.query(api.eventCrews.listEventCrews, { eventId });
    expect(crews.map((c) => c.applianceName)).toEqual([
      "Wyndham Vale Pumper",
      "Wyndham Vale Tanker",
    ]);
    expect(crews[0]).toMatchObject({ crewLeader: null, driver: null, crewMembers: [] });
  });

  it("lets a team leader fill the seats, with members and outside-brigade names", async () => {
    const { eventId, aliceId, bobId, asAlice, asBob } = await setup();
    const [pumper] = await asAlice.query(api.eventCrews.listEventCrews, { eventId });

    await asAlice.mutation(api.eventCrews.saveEventCrew, {
      eventId,
      crewId: pumper._id,
      applianceName: pumper.applianceName,
      crewLeader: { userId: aliceId },
      driver: { userId: bobId },
      crewMembers: [{ name: "Werribee volunteer" }],
      notes: "Meet at station 0800",
    });

    const [saved] = await asBob.query(api.eventCrews.listEventCrews, { eventId });
    expect(saved.crewLeader).toMatchObject({ name: "Alice Ash", external: false });
    expect(saved.driver).toMatchObject({ name: "Bob Birch" });
    expect(saved.crewMembers).toEqual([{ name: "Werribee volunteer", external: true }]);
    expect(saved.notes).toBe("Meet at station 0800");

    // The events list tells Bob where he's sitting, and counts the seats
    const event = await asBob.query(api.events.getEvent, { eventId });
    expect(event?.myCrewSeat).toEqual({ applianceName: "Wyndham Vale Pumper", role: "Driver" });
    expect(event?.crews).toEqual([
      { applianceName: "Wyndham Vale Pumper", filled: 3, total: 5 },
      { applianceName: "Wyndham Vale Tanker", filled: 0, total: 5 },
    ]);
  });

  it("keeps crewing and the roster independent", async () => {
    const { eventId, bobId, asAdmin } = await setup();
    const [pumper] = await asAdmin.query(api.eventCrews.listEventCrews, { eventId });
    await asAdmin.mutation(api.eventCrews.saveEventCrew, {
      eventId,
      crewId: pumper._id,
      applianceName: pumper.applianceName,
      driver: { userId: bobId },
      crewMembers: [],
    });

    const roster = await asAdmin.query(api.events.getEventAttendance, { eventId });
    expect(roster?.attending).toEqual([]);
  });

  it("stops a member who can't manage the event from crewing it", async () => {
    const { eventId, bobId, asBob } = await setup();
    await expect(
      asBob.mutation(api.eventCrews.saveEventCrew, {
        eventId,
        applianceName: "Wyndham Vale FCV",
        driver: { userId: bobId },
        crewMembers: [],
      })
    ).rejects.toThrow();
    expect(await asBob.query(api.eventCrews.getCrewPickerStatus, { eventId })).toBeNull();
  });

  it("refuses the same member in two seats, and two crews for one appliance", async () => {
    const { eventId, aliceId, asAdmin } = await setup();
    await expect(
      asAdmin.mutation(api.eventCrews.saveEventCrew, {
        eventId,
        applianceName: "Wyndham Vale FCV",
        driver: { userId: aliceId },
        crewLeader: { userId: aliceId },
        crewMembers: [],
      })
    ).rejects.toThrow("only take one seat");
    await expect(
      asAdmin.mutation(api.eventCrews.saveEventCrew, {
        eventId,
        applianceName: "WYNDHAM VALE PUMPER",
        crewMembers: [],
      })
    ).rejects.toThrow("already has a crew");
  });

  it("reconciles appliances on edit, keeping crews for the ones still listed", async () => {
    const { eventId, aliceId, asAdmin } = await setup();
    const [pumper] = await asAdmin.query(api.eventCrews.listEventCrews, { eventId });
    await asAdmin.mutation(api.eventCrews.saveEventCrew, {
      eventId,
      crewId: pumper._id,
      applianceName: pumper.applianceName,
      crewLeader: { userId: aliceId },
      crewMembers: [],
    });

    await asAdmin.mutation(api.events.updateEvent, {
      eventId,
      crewAppliances: ["Wyndham Vale Pumper", "Wyndham Vale FCV"],
    });
    const crews = await asAdmin.query(api.eventCrews.listEventCrews, { eventId });
    expect(crews.map((c) => c.applianceName)).toEqual([
      "Wyndham Vale Pumper",
      "Wyndham Vale FCV",
    ]);
    expect(crews[0].crewLeader?.name).toBe("Alice Ash");

    // An empty list switches crewing off
    await asAdmin.mutation(api.events.updateEvent, { eventId, crewAppliances: [] });
    expect(await asAdmin.query(api.eventCrews.listEventCrews, { eventId })).toEqual([]);
  });

  it("removes the crews when the event is deleted", async () => {
    const { t, eventId, asAdmin } = await setup();
    await asAdmin.mutation(api.events.cancelEvent, { eventId });
    await asAdmin.mutation(api.events.deleteEvent, { eventId });
    const left = await t.run((ctx) => ctx.db.query("eventCrews").collect());
    expect(left).toEqual([]);
  });
});
