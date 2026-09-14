// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const FUTURE = "2099-06-01";

/** Organiser + two members, on an event that takes guests. */
async function setup(
  eventFields: {
    allowsGuests?: boolean;
    maxGuestsPerMember?: number;
    collectsDietary?: boolean;
    hasShifts?: boolean;
  } = { allowsGuests: true }
) {
  const t = convexTest(schema, modules);

  const { adminId, aliceId, bobId } = await t.run(async (ctx) => {
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

  const asAdmin = t.withIdentity({ subject: adminId });

  const eventId = await asAdmin.mutation(api.events.createEvent, {
    title: "Annual dinner",
    startDate: FUTURE,
    isAllDay: false,
    startTime: "19:00",
    endTime: "23:00",
    ...eventFields,
  });

  return {
    t,
    eventId,
    aliceId,
    bobId,
    asAdmin,
    asAlice: t.withIdentity({ subject: aliceId }),
    asBob: t.withIdentity({ subject: bobId }),
  };
}

describe("event guests (+1s)", () => {
  it("counts guests separately from members", async () => {
    const { eventId, asAdmin, asAlice, asBob } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 2 });
    await asBob.mutation(api.events.setRsvp, { eventId, status: "attending" });

    const event = await asAdmin.query(api.events.getEvent, { eventId });
    // Two members going, two extra heads - the member count must not absorb
    // the guests, or the roster and attendance sheet start lying.
    expect(event?.counts.attending).toBe(2);
    expect(event?.counts.guests).toBe(2);
  });

  it("drops a member's guests when they stop attending", async () => {
    const { eventId, asAdmin, asAlice } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 3 });
    expect((await asAdmin.query(api.events.getEvent, { eventId }))?.counts.guests).toBe(3);

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "notAttending" });
    expect((await asAdmin.query(api.events.getEvent, { eventId }))?.counts.guests).toBe(0);

    // Coming back is a fresh answer, not a resurrected one
    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });
    expect((await asAdmin.query(api.events.getEvent, { eventId }))?.counts.guests).toBe(0);
  });

  it("keeps a plain yes/no RSVP from disturbing an existing guest count", async () => {
    const { eventId, asAdmin, asAlice } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 2 });
    // Pressing "Yes" again (the buttons send no guestCount) must not reset it
    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });
    expect((await asAdmin.query(api.events.getEvent, { eventId }))?.counts.guests).toBe(2);
  });

  it("enforces the organiser's cap", async () => {
    const { eventId, asAlice } = await setup({ allowsGuests: true, maxGuestsPerMember: 1 });

    await expect(
      asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 2 })
    ).rejects.toThrow(/at most 1 guest/);

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 1 });
  });

  it("leaves answers already given alone when the cap is lowered", async () => {
    const { eventId, asAdmin, asAlice } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 4 });
    await asAdmin.mutation(api.events.updateEvent, { eventId, maxGuestsPerMember: 2 });

    // Alice already told the organiser four; silently shrinking that is worse
    // than the organiser seeing one row over the line.
    expect((await asAdmin.query(api.events.getEvent, { eventId }))?.counts.guests).toBe(4);
  });

  it("refuses guests on an event that isn't taking them", async () => {
    const { eventId, asAlice } = await setup({ allowsGuests: false });

    await expect(
      asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 1 })
    ).rejects.toThrow(/isn't taking guests/);
  });

  it("rejects fractional and negative counts", async () => {
    const { eventId, asAlice } = await setup();

    await expect(
      asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: -1 })
    ).rejects.toThrow(/whole number/);
    await expect(
      asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 1.5 })
    ).rejects.toThrow(/whole number/);
  });

  it("stops counting guests while responses are closed, and restores them on reopen", async () => {
    const { eventId, asAdmin, asAlice } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 2 });
    await asAdmin.mutation(api.events.setMemberResponses, { eventId, mode: "closed" });
    expect((await asAdmin.query(api.events.getEvent, { eventId }))?.counts.guests).toBe(0);

    await asAdmin.mutation(api.events.setMemberResponses, { eventId, mode: "open" });
    expect((await asAdmin.query(api.events.getEvent, { eventId }))?.counts.guests).toBe(2);
  });

  it("never offers guests on a shift event", async () => {
    const { eventId, asAdmin } = await setup({ hasShifts: true, allowsGuests: true });
    const event = await asAdmin.query(api.events.getEvent, { eventId });
    expect(event?.allowsGuests).toBeUndefined();
  });

  it("reports guests per member in the attendance list", async () => {
    const { eventId, aliceId, asAdmin, asAlice, asBob } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 2 });
    await asBob.mutation(api.events.setRsvp, { eventId, status: "attending" });

    const attendance = await asAdmin.query(api.events.getEventAttendance, { eventId });
    expect(attendance?.guestTotal).toBe(2);
    expect(attendance?.guestCounts).toEqual([{ userId: aliceId, count: 2 }]);
  });
});

describe("dietary requirements", () => {
  it("keeps notes with the RSVP and shows them to the organiser only", async () => {
    const { eventId, asAdmin, asAlice, asBob } = await setup({
      allowsGuests: true,
      collectsDietary: true,
    });

    await asAlice.mutation(api.events.setRsvp, {
      eventId,
      status: "attending",
      guestCount: 1,
      dietaryNotes: "  One gluten free  ",
    });

    const forOrganiser = await asAdmin.query(api.events.getEventAttendance, { eventId });
    expect(forOrganiser?.dietary).toEqual([
      expect.objectContaining({ notes: "One gluten free" }),
    ]);

    // Health information: an ordinary member reading the same list sees none
    const forMember = await asBob.query(api.events.getEventAttendance, { eventId });
    expect(forMember?.dietary).toBeNull();
  });

  it("refuses notes on an event that isn't asking for them", async () => {
    const { eventId, asAlice } = await setup({ allowsGuests: true });

    await expect(
      asAlice.mutation(api.events.setRsvp, {
        eventId,
        status: "attending",
        dietaryNotes: "Vegetarian",
      })
    ).rejects.toThrow(/isn't collecting dietary/);
  });

  it("clears notes when the member stops attending", async () => {
    const { eventId, asAdmin, asAlice } = await setup({
      allowsGuests: true,
      collectsDietary: true,
    });

    await asAlice.mutation(api.events.setRsvp, {
      eventId,
      status: "attending",
      dietaryNotes: "Vegetarian",
    });
    await asAlice.mutation(api.events.setRsvp, { eventId, status: "notAttending" });

    const attendance = await asAdmin.query(api.events.getEventAttendance, { eventId });
    expect(attendance?.dietary).toEqual([]);
  });
});
