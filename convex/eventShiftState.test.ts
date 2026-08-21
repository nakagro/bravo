// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const FUTURE = "2099-06-01";

/**
 * `bob` is an ordinary Firefighter - the member whose card the shift button is
 * drawn on. `admin` organises the event and does the allocating.
 */
async function setup() {
  const t = convexTest(schema, modules);

  const { adminId, bobId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Org Aniser",
      firstName: "Org",
      lastName: "Aniser",
      rank: "Captain" as const,
      isAdmin: true,
    });
    const bobId = await ctx.db.insert("users", {
      name: "Bob Birch",
      firstName: "Bob",
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

    return { adminId, bobId };
  });

  const asAdmin = t.withIdentity({ subject: adminId });
  const eventId = await asAdmin.mutation(api.events.createEvent, {
    title: "Bunnings sausage sizzle",
    startDate: FUTURE,
    isAllDay: true,
    hasShifts: true,
    slots: [{ label: "Morning" }, { label: "Afternoon" }],
  });

  return {
    eventId,
    bobId,
    asAdmin,
    asBob: t.withIdentity({ subject: bobId }),
  };
}

/**
 * The card's shift button reads `myRsvp` + `iAmRostered`. Both an offer and an
 * allocation make `myRsvp` "attending", so without the second flag the card
 * can't tell "I've put my hand up" from "I've been given the shift" - which is
 * what made it claim "on a shift" to members who had only offered.
 */
describe("iAmRostered", () => {
  it("stays false while a member has only offered a shift", async () => {
    const { asAdmin, asBob, eventId, bobId } = await setup();

    const board = await asAdmin.query(api.events.getEventRoster, { eventId });
    const slotId = board!.slots[0]._id;

    await asBob.mutation(api.events.toggleSlotResponse, { slotId });

    const event = await asBob.query(api.events.getEvent, { eventId });
    expect(event).toMatchObject({ myRsvp: "attending", iAmRostered: false });

    // ...and flips once the organiser actually allocates them
    await asAdmin.mutation(api.events.toggleSlotAllocation, { slotId, userId: bobId });
    expect(await asBob.query(api.events.getEvent, { eventId })).toMatchObject({
      myRsvp: "attending",
      iAmRostered: true,
    });
  });

  it("is false for a member who has done nothing", async () => {
    const { asBob, eventId } = await setup();

    expect(await asBob.query(api.events.getEvent, { eventId })).toMatchObject({
      myRsvp: null,
      iAmRostered: false,
    });
  });

  it("stays true for a rostered member who then declines", async () => {
    const { asAdmin, asBob, eventId, bobId } = await setup();

    const board = await asAdmin.query(api.events.getEventRoster, { eventId });
    await asAdmin.mutation(api.events.toggleSlotAllocation, {
      slotId: board!.slots[0]._id,
      userId: bobId,
    });
    await asBob.mutation(api.events.declineSlotEvent, { eventId });

    // The conflict is preserved rather than erased - the card resolves it in
    // favour of "can't make it", the organiser re-rosters the shift.
    expect(await asBob.query(api.events.getEvent, { eventId })).toMatchObject({
      myRsvp: "notAttending",
      iAmRostered: true,
    });
  });
});
