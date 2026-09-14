// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const FUTURE = "2099-06-01";

async function setup(eventFields: { hasShifts?: boolean; allowsGuests?: boolean } = {}) {
  const t = convexTest(schema, modules);

  const { adminId, aliceId } = await t.run(async (ctx) => {
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
    await ctx.db.insert("moduleSettings", {
      moduleId: "events",
      moduleName: "Events",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      updatedAt: Date.now(),
    });
    return { adminId, aliceId };
  });

  const asAdmin = t.withIdentity({ subject: adminId });
  const eventId = await asAdmin.mutation(api.events.createEvent, {
    title: "Annual dinner",
    startDate: FUTURE,
    isAllDay: true,
    ...eventFields,
  });

  return { t, eventId, aliceId, asAdmin, asAlice: t.withIdentity({ subject: aliceId }) };
}

describe("response activity", () => {
  it("records a first answer and each change, newest first", async () => {
    const { eventId, asAdmin, asAlice } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });
    await asAlice.mutation(api.events.setRsvp, { eventId, status: "maybe" });
    await asAlice.mutation(api.events.setRsvp, { eventId, status: "notAttending" });

    const activity = await asAdmin.query(api.events.getResponseActivity, { eventId });
    expect(activity?.map((entry) => [entry.oldValue, entry.newValue])).toEqual([
      ["maybe", "notAttending"],
      ["attending", "maybe"],
      [null, "attending"],
    ]);
  });

  it("ignores a member pressing the same answer again", async () => {
    const { eventId, asAdmin, asAlice } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });
    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });

    const activity = await asAdmin.query(api.events.getResponseActivity, { eventId });
    expect(activity).toHaveLength(1);
  });

  it("records a shift picked up and dropped, which the tables themselves forget", async () => {
    const { eventId, asAdmin, asAlice } = await setup({ hasShifts: true });

    const slotId = await asAdmin.mutation(api.events.updateEvent, {
      eventId,
      slots: [{ label: "Morning" }],
    }).then(async () => {
      const slots = await asAdmin.query(api.events.getEventSlots, { eventId });
      return slots[0]._id;
    });

    await asAlice.mutation(api.events.toggleSlotResponse, { slotId });
    await asAlice.mutation(api.events.toggleSlotResponse, { slotId });

    const activity = await asAdmin.query(api.events.getResponseActivity, { eventId });
    const shifts = activity?.filter((entry) => entry.field === "shift");
    // The eventSlotResponses row is gone; this log is the only trace left
    expect(shifts?.map((entry) => [entry.oldValue, entry.newValue])).toEqual([
      ["Morning", null],
      [null, "Morning"],
    ]);
  });

  it("records guest-count changes", async () => {
    const { eventId, asAdmin, asAlice } = await setup({ allowsGuests: true });

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending", guestCount: 2 });

    const activity = await asAdmin.query(api.events.getResponseActivity, { eventId });
    expect(activity?.find((entry) => entry.field === "guests")).toMatchObject({
      oldValue: 0,
      newValue: 2,
    });
  });

  it("is manager-only", async () => {
    const { eventId, asAlice } = await setup();
    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });

    expect(await asAlice.query(api.events.getResponseActivity, { eventId })).toBeNull();
  });

  it("exposes answered/changed timestamps to the organiser only", async () => {
    const { eventId, aliceId, asAdmin, asAlice } = await setup();

    await asAlice.mutation(api.events.setRsvp, { eventId, status: "attending" });

    const forOrganiser = await asAdmin.query(api.events.getEventAttendance, { eventId });
    expect(forOrganiser?.responseTimes).toEqual([
      expect.objectContaining({ userId: aliceId }),
    ]);

    const forMember = await asAlice.query(api.events.getEventAttendance, { eventId });
    expect(forMember?.responseTimes).toBeNull();
  });
});
