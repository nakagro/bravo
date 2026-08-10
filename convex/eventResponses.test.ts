// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Far enough out that the "already happened" guard never trips
const FUTURE = "2099-06-01";

/**
 * An organiser (isAdmin, so requireEventsAdmin passes without module wiring)
 * and two ordinary members, with the events module open for the Action Centre.
 */
async function setup(eventFields: { hasShifts?: boolean; respondBy?: string } = {}) {
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
    title: "Bunnings sausage sizzle",
    startDate: FUTURE,
    isAllDay: false,
    startTime: "09:00",
    endTime: "14:00",
    ...eventFields,
  });

  return {
    t,
    eventId,
    adminId,
    aliceId,
    bobId,
    asAdmin,
    asAlice: t.withIdentity({ subject: aliceId }),
    asBob: t.withIdentity({ subject: bobId }),
  };
}

type SignedIn = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

const goingIds = async (as: SignedIn, eventId: Id<"events">) => {
  const attendance = await as.query(api.events.getEventAttendance, { eventId });
  return (attendance?.attending ?? []).map((m) => m._id).sort();
};

describe("member responses: open ↔ closed", () => {
  it("stops counting responses when closed and counts them again when reopened", async () => {
    const { eventId, aliceId, asAdmin, asAlice } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });
    expect(await goingIds(asAdmin, eventId)).toEqual([aliceId]);

    // Closing without carry-over: Alice's yes is ignored, not deleted
    await asAdmin.mutation(api.events.setMemberResponses, { eventId, mode: "closed" });
    expect(await goingIds(asAdmin, eventId)).toEqual([]);

    // ...which the round trip proves - nothing had to be re-entered
    await asAdmin.mutation(api.events.setMemberResponses, { eventId, mode: "open" });
    expect(await goingIds(asAdmin, eventId)).toEqual([aliceId]);
  });

  it("carries the people who already said yes onto the roster when closing", async () => {
    const { eventId, aliceId, bobId, asAdmin, asAlice, asBob } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });
    await asBob.mutation(api.events.setRsvp, { eventId, status: "attending" });

    // The organiser keeps Alice and drops Bob from their list
    await asAdmin.mutation(api.events.setMemberResponses, {
      eventId,
      mode: "closed",
      carryOverUserIds: [aliceId],
    });

    expect(await goingIds(asAdmin, eventId)).toEqual([aliceId]);

    // Bob's own yes is still on file, so reopening brings him back
    await asAdmin.mutation(api.events.setMemberResponses, { eventId, mode: "open" });
    expect(await goingIds(asAdmin, eventId)).toEqual([aliceId, bobId].sort());
  });

  it("refuses a yes or a maybe while closed, but always takes a decline", async () => {
    const { eventId, aliceId, asAdmin, asAlice } = await setup();

    await asAdmin.mutation(api.events.setMemberResponses, { eventId, mode: "closed" });
    await asAdmin.mutation(api.events.toggleEventAllocation, { eventId, userId: aliceId });
    expect(await goingIds(asAdmin, eventId)).toEqual([aliceId]);

    await expect(
      asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" })
    ).rejects.toThrow(/organiser/i);
    await expect(
      asAlice.mutation(api.events.setRsvp, { eventId, status: "maybe" })
    ).rejects.toThrow(/organiser/i);

    // Being rostered isn't agreeing - the decline must get through, and it
    // beats the placement
    await asAlice.mutation(api.events.declineSlotEvent, { eventId });
    expect(await goingIds(asAdmin, eventId)).toEqual([]);

    const event = await asAdmin.query(api.events.getEvent, { eventId });
    expect(event!.myRsvp).toBe(null);
    const alicesView = await asAlice.query(api.events.getEvent, { eventId });
    expect(alicesView!.myRsvp).toBe("notAttending");
  });

  it("rosters a shiftless event through event-level allocations", async () => {
    const { eventId, aliceId, asAdmin } = await setup();

    const added = await asAdmin.mutation(api.events.toggleEventAllocation, {
      eventId,
      userId: aliceId,
    });
    expect(added).toBe(true);
    expect(await goingIds(asAdmin, eventId)).toEqual([aliceId]);

    const roster = await asAdmin.query(api.events.getEventRoster, { eventId });
    expect(roster!.eventAllocatedIds).toEqual([aliceId]);

    const removed = await asAdmin.mutation(api.events.toggleEventAllocation, {
      eventId,
      userId: aliceId,
    });
    expect(removed).toBe(false);
    expect(await goingIds(asAdmin, eventId)).toEqual([]);
  });

  it("blocks shift picks while closed and keeps allocations counting", async () => {
    const { eventId, aliceId, bobId, asAdmin, asAlice } = await setup({ hasShifts: true });

    await asAdmin.mutation(api.events.updateEvent, {
      eventId,
      hasShifts: true,
      slots: [{ label: "Morning" }],
    });
    const [slot] = await asAdmin.query(api.events.getEventSlots, { eventId });

    await asAlice.mutation(api.events.toggleSlotResponse, { slotId: slot._id });
    expect(await goingIds(asAdmin, eventId)).toEqual([aliceId]);

    await asAdmin.mutation(api.events.setMemberResponses, { eventId, mode: "closed" });
    await asAdmin.mutation(api.events.toggleSlotAllocation, {
      slotId: slot._id,
      userId: bobId,
    });

    // Interest is parked, the roster stands
    expect(await goingIds(asAdmin, eventId)).toEqual([bobId]);
    await expect(
      asAlice.mutation(api.events.toggleSlotResponse, { slotId: slot._id })
    ).rejects.toThrow(/organiser/i);
  });

  it("keeps the roster when shifts are turned off", async () => {
    const { eventId, aliceId, asAdmin } = await setup({ hasShifts: true });

    await asAdmin.mutation(api.events.updateEvent, {
      eventId,
      hasShifts: true,
      slots: [{ label: "Morning" }, { label: "Afternoon" }],
    });
    const slots = await asAdmin.query(api.events.getEventSlots, { eventId });
    for (const slot of slots) {
      await asAdmin.mutation(api.events.toggleSlotAllocation, {
        slotId: slot._id,
        userId: aliceId,
      });
    }

    await asAdmin.mutation(api.events.updateEvent, { eventId, hasShifts: false, slots: [] });

    // Alice was on both shifts; she stays on once, at the event level
    expect(await goingIds(asAdmin, eventId)).toEqual([aliceId]);
    const roster = await asAdmin.query(api.events.getEventRoster, { eventId });
    expect(roster!.eventAllocatedIds).toEqual([aliceId]);
    expect(roster!.slots).toEqual([]);
  });

  it("stops asking members to RSVP in the action centre once closed", async () => {
    // A respondBy keeps the event in the provider's window regardless of how
    // far off it is
    const { eventId, asAdmin, asAlice } = await setup({ respondBy: FUTURE });

    const before = await asAlice.query(api.actionCentre.getMyActions, {});
    expect(before.map((a) => a.id)).toContain(`events:rsvp:${eventId}`);

    await asAdmin.mutation(api.events.setMemberResponses, { eventId, mode: "closed" });

    const after = await asAlice.query(api.actionCentre.getMyActions, {});
    expect(after.map((a) => a.id)).not.toContain(`events:rsvp:${eventId}`);
  });
});
