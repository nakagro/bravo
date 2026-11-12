// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const FUTURE = "2099-06-01";
const FUTURE_MS = Date.UTC(2099, 5, 1);

// `admin` runs events and crews deployments; `alice` and `bob` are plain
// members; `carol` is disabled.
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = (first: string, extra: object = {}) =>
      ctx.db.insert("users", { name: `${first} Test`, firstName: first, lastName: "Test", rank: "Firefighter" as const, ...extra });
    const adminId = await user("Admin", { isAdmin: true, rank: "Captain" as const });
    const aliceId = await user("Alice");
    const bobId = await user("Bob");
    const carolId = await user("Carol", { isDisabled: true });
    for (const moduleId of ["events", "availability", "availabilityAdmin"]) {
      await ctx.db.insert("moduleSettings", {
        moduleId,
        moduleName: moduleId,
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: moduleId === "availabilityAdmin" ? ("Lieutenant" as const) : undefined,
        updatedAt: Date.now(),
      });
    }
    return { adminId, aliceId, bobId, carolId };
  });
  const asAdmin = t.withIdentity({ subject: ids.adminId });
  const eventId = await asAdmin.mutation(api.events.createEvent, {
    title: "Open day",
    startDate: FUTURE,
    startTime: "09:00",
    isAllDay: false,
    location: "Main Station",
    crewAppliances: ["Tanker 1"],
  });
  const [crew] = await asAdmin.query(api.eventCrews.listEventCrews, { eventId });
  return {
    t,
    ...ids,
    eventId,
    crewId: crew._id,
    asAdmin,
    asAlice: t.withIdentity({ subject: ids.aliceId }),
    asBob: t.withIdentity({ subject: ids.bobId }),
  };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

async function seat(c: Ctx, seats: { driver?: Id<"users">; crew?: (Id<"users"> | string)[] }) {
  await c.asAdmin.mutation(api.eventCrews.saveEventCrew, {
    eventId: c.eventId,
    crewId: c.crewId,
    applianceName: "Tanker 1",
    driver: seats.driver ? { userId: seats.driver } : undefined,
    crewMembers: (seats.crew ?? []).map((s) => (s.startsWith("users") || s.length > 20 ? { userId: s as Id<"users"> } : { name: s })),
  });
}

const preview = (c: Ctx, audience: "changes" | "everyone" = "changes", message?: string) =>
  c.asAdmin.query(api.assignmentNotices.previewAssignmentNotice, {
    source: "event",
    scopeId: c.eventId,
    audience,
    message,
  });

async function send(c: Ctx, audience: "changes" | "everyone" = "changes", message?: string) {
  const p = (await preview(c, audience, message))!;
  return await c.asAdmin.mutation(api.assignmentNotices.sendAssignmentNotice, {
    source: "event",
    scopeId: c.eventId,
    audience,
    message,
    fingerprint: p.fingerprint,
  });
}

describe("assignment notices", () => {
  it("renders the default text with real values and lists typed names as not notified", async () => {
    const c = await setup();
    await seat(c, { driver: c.aliceId, crew: ["Visitor Vic"] });
    const p = (await preview(c, "changes", "Bring hi-vis."))!;
    expect(p.recipients).toHaveLength(1);
    expect(p.recipients[0]).toMatchObject({
      userId: c.aliceId,
      state: "new",
      title: "You're rostered: Open day",
      body: "Driver · Tanker 1 · Mon 1 Jun 9:00 AM · Main Station\nBring hi-vis.",
      push: "noDevice",
    });
    expect(p.notNotified).toEqual([{ name: "Visitor Vic", reason: "Not a BRAVO member" }]);
    expect(p.pendingCount).toBe(1);
  });

  it("tracks new, changed, unchanged and removed against receipts", async () => {
    const c = await setup();
    await seat(c, { driver: c.aliceId, crew: [c.bobId] });
    expect(await send(c)).toBe(2);

    let p = (await preview(c))!;
    expect(p.recipients).toHaveLength(0);
    expect(p.unchangedCount).toBe(2);
    expect(p.pendingCount).toBe(0);

    // Changing the event itself leaves everyone unchanged.
    await c.asAdmin.mutation(api.events.updateEvent, { eventId: c.eventId, location: "Elsewhere" });
    expect((await preview(c))!.pendingCount).toBe(0);

    // Alice moves seat, Bob comes off.
    await seat(c, { crew: [c.aliceId] });
    p = (await preview(c))!;
    const byUser = new Map(p.recipients.map((r) => [r.userId, r]));
    expect(byUser.get(c.aliceId)).toMatchObject({ state: "changed", title: "Roster changed: Open day" });
    expect(byUser.get(c.bobId)).toMatchObject({ state: "removed", title: "Off the roster: Open day" });

    // Everyone includes the up-to-date.
    await send(c);
    expect((await preview(c, "everyone"))!.recipients.map((r) => r.state)).toEqual(["unchanged"]);

    // Bob is told once he's removed; still off, he isn't listed again. Re-added, he's new.
    expect((await preview(c, "everyone"))!.recipients.some((r) => r.userId === c.bobId)).toBe(false);
    await seat(c, { crew: [c.aliceId, c.bobId] });
    expect((await preview(c))!.recipients.find((r) => r.userId === c.bobId)?.state).toBe("new");
  });

  it("stays silent for someone added and removed before any send", async () => {
    const c = await setup();
    await seat(c, { driver: c.aliceId });
    await seat(c, {});
    expect((await preview(c, "everyone"))!.recipients).toHaveLength(0);
  });

  it("refuses a stale fingerprint and a double send, and writes nothing on refusal", async () => {
    const c = await setup();
    await seat(c, { driver: c.aliceId });
    const p = (await preview(c))!;
    await seat(c, { driver: c.bobId });
    await expect(
      c.asAdmin.mutation(api.assignmentNotices.sendAssignmentNotice, {
        source: "event",
        scopeId: c.eventId,
        audience: "changes",
        fingerprint: p.fingerprint,
      }),
    ).rejects.toThrow("changed");
    expect(await c.t.run((ctx) => ctx.db.query("assignmentReceipts").collect())).toHaveLength(0);

    const fresh = (await preview(c, "everyone"))!;
    const args = { source: "event" as const, scopeId: c.eventId, audience: "everyone" as const, fingerprint: fresh.fingerprint };
    await c.asAdmin.mutation(api.assignmentNotices.sendAssignmentNotice, args);
    await expect(c.asAdmin.mutation(api.assignmentNotices.sendAssignmentNotice, args)).rejects.toThrow();

    const scheduled = await c.t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.filter((s) => s.name.includes("deliverToUsers"))).toHaveLength(1);
  });

  it("uses the stored template, and reset goes back to the default", async () => {
    const c = await setup();
    await seat(c, { driver: c.aliceId });
    await c.asAdmin.mutation(api.notificationTemplates.saveNotificationTemplate, {
      key: "event.assigned",
      title: "Hi {firstName}, you're on {eventTitle}",
      body: "",
    });
    expect((await preview(c))!.recipients[0].title).toBe("Hi Alice, you're on Open day");
    await expect(
      c.asAdmin.mutation(api.notificationTemplates.saveNotificationTemplate, {
        key: "event.assigned",
        title: "{evntTitle}",
        body: "",
      }),
    ).rejects.toThrow("{evntTitle}");
    await expect(
      c.asAlice.mutation(api.notificationTemplates.saveNotificationTemplate, { key: "event.assigned", title: "x", body: "" }),
    ).rejects.toThrow();
    await c.asAdmin.mutation(api.notificationTemplates.resetNotificationTemplate, { key: "event.assigned" });
    expect((await preview(c))!.recipients[0].title).toBe("You're rostered: Open day");
  });

  it("returns null for a member who can't send, and for a cancelled event", async () => {
    const c = await setup();
    await seat(c, { driver: c.aliceId });
    expect(
      await c.asBob.query(api.assignmentNotices.previewAssignmentNotice, {
        source: "event",
        scopeId: c.eventId,
        audience: "changes",
      }),
    ).toBeNull();
    await c.asAdmin.mutation(api.events.setTeamLeaders, { eventId: c.eventId, userIds: [c.bobId] });
    expect(
      await c.asBob.query(api.assignmentNotices.previewAssignmentNotice, {
        source: "event",
        scopeId: c.eventId,
        audience: "changes",
      }),
    ).not.toBeNull();
    await c.asAdmin.mutation(api.events.cancelEvent, { eventId: c.eventId });
    expect(await preview(c)).toBeNull();
  });

  it("lists an unreachable member as not notified, and gives a seated sender their own notice", async () => {
    const c = await setup();
    await seat(c, { driver: c.adminId, crew: [c.carolId] });
    const p = (await preview(c))!;
    expect(p.recipients.map((r) => r.userId)).toEqual([c.adminId]);
    expect(p.notNotified).toEqual([{ name: "Carol Test", reason: "Account disabled" }]);
  });

  it("shows the receipt as an Action Centre item that a re-send brings back", async () => {
    const c = await setup();
    await seat(c, { driver: c.aliceId });
    await send(c);
    let items = (await c.asAlice.query(api.actionCentre.getMyActions, {})).filter((a) => a.id.startsWith("assignment:"));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "notice", title: "You're rostered: Open day" });
    await c.asAlice.mutation(api.actionCentre.dismissAction, { actionId: items[0].id });
    expect((await c.asAlice.query(api.actionCentre.getMyActions, {})).some((a) => a.id.startsWith("assignment:"))).toBe(false);
    await new Promise((r) => setTimeout(r, 5));
    await send(c, "everyone");
    items = (await c.asAlice.query(api.actionCentre.getMyActions, {})).filter((a) => a.id.startsWith("assignment:"));
    expect(items).toHaveLength(1);
  });

  it("deletes an event's receipts with the event", async () => {
    const c = await setup();
    await seat(c, { driver: c.aliceId });
    await send(c);
    await c.asAdmin.mutation(api.events.cancelEvent, { eventId: c.eventId });
    await c.asAdmin.mutation(api.events.deleteEvent, { eventId: c.eventId });
    expect(await c.t.run((ctx) => ctx.db.query("assignmentReceipts").collect())).toHaveLength(0);
  });
});

describe("deployment crew notices", () => {
  it("needs availabilityAdmin, and keeps receipts when the day's crews are deleted", async () => {
    const c = await setup();
    const crewId = await c.asAdmin.mutation(api.deploymentCrews.createCrew, {
      date: FUTURE_MS,
      applianceName: "Tanker 1",
      driver: { userId: c.aliceId },
      crewMembers: [],
    });
    const args = { source: "deploymentDay" as const, scopeId: String(FUTURE_MS), audience: "changes" as const };
    expect(await c.asAlice.query(api.assignmentNotices.previewAssignmentNotice, args)).toBeNull();

    const p = (await c.asAdmin.query(api.assignmentNotices.previewAssignmentNotice, args))!;
    expect(p.recipients[0]).toMatchObject({ title: "Deployment crew: Mon 1 Jun", body: "Driver · Tanker 1. Tap to see the full crew." });
    await c.asAdmin.mutation(api.assignmentNotices.sendAssignmentNotice, { ...args, fingerprint: p.fingerprint });

    await c.asAdmin.mutation(api.deploymentCrews.deleteCrew, { crewId });
    const after = (await c.asAdmin.query(api.assignmentNotices.previewAssignmentNotice, args))!;
    expect(after.recipients[0]).toMatchObject({ state: "removed", body: "You're no longer crewed for Mon 1 Jun." });
    expect(
      await c.asAdmin.query(api.assignmentNotices.deploymentDaysWithReceiptsOnly, {
        startDate: FUTURE_MS - 86_400_000,
        endDate: FUTURE_MS + 86_400_000,
      }),
    ).toEqual([FUTURE_MS]);
  });
});

describe("event change notices", () => {
  async function involvedSetup() {
    const c = await setup();
    const daveId = await c.t.run((ctx) =>
      ctx.db.insert("users", { name: "Dave Test", firstName: "Dave", lastName: "Test", rank: "Firefighter" as const }),
    );
    await seat(c, { driver: c.aliceId });
    await c.asBob.mutation(api.events.setRsvp, { eventId: c.eventId, status: "attending" });
    await c.t.withIdentity({ subject: daveId }).mutation(api.events.setRsvp, { eventId: c.eventId, status: "notAttending" });
    return { ...c, daveId };
  }

  const changePreview = (c: Ctx, kind: "cancelled" | "detailsChanged" | "restored", message?: string) =>
    c.asAdmin.query(api.eventChangeNotices.previewEventChangeNotice, { eventId: c.eventId, kind, message });

  it("counts rostered and going, not decliners or the sender", async () => {
    const c = await involvedSetup();
    const p = (await changePreview(c, "cancelled", "Hall double-booked"))!;
    expect(p.recipients.map((r) => r.userId).sort()).toEqual([c.aliceId, c.bobId].sort());
    expect(p.counts).toMatchObject({ rostered: 1, going: 1 });
    expect(p.title).toBe("Cancelled: Open day");
    expect(p.body).toBe("Mon 1 Jun 9:00 AM · Main Station\nHall double-booked");

    await c.asAdmin.mutation(api.events.setMemberResponses, { eventId: c.eventId, mode: "closed" });
    expect((await changePreview(c, "cancelled"))!.recipients.map((r) => r.userId)).toEqual([c.aliceId]);
  });

  it("cancels and notifies in one transaction; a stale fingerprint changes nothing", async () => {
    const c = await involvedSetup();
    const p = (await changePreview(c, "cancelled"))!;
    await expect(
      c.asAdmin.mutation(api.events.cancelEvent, { eventId: c.eventId, notifyFingerprint: "stale" }),
    ).rejects.toThrow();
    expect((await c.t.run((ctx) => ctx.db.get(c.eventId)))!.status).toBe("active");

    await c.asAdmin.mutation(api.events.cancelEvent, { eventId: c.eventId, notifyFingerprint: p.fingerprint });
    const rows = await c.t.run((ctx) => ctx.db.query("actionNotices").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "cancelled", title: "Cancelled: Open day" });
    // Already announced: not offered again.
    expect(await changePreview(c, "cancelled")).toBeNull();
    expect(await changePreview(c, "detailsChanged")).toBeNull();

    // Back on goes to the same members, even after the roster changes.
    await seat(c, {});
    const back = (await changePreview(c, "restored"))!;
    expect(back.recipients.map((r) => r.userId).sort()).toEqual([c.aliceId, c.bobId].sort());
    await c.asAdmin.mutation(api.events.restoreEvent, { eventId: c.eventId, notifyFingerprint: back.fingerprint });
    const after = await c.t.run((ctx) => ctx.db.query("actionNotices").collect());
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ kind: "restored", title: "Back on: Open day" });

    // A second cancel can be announced again.
    await new Promise((r) => setTimeout(r, 5));
    await c.asAdmin.mutation(api.events.cancelEvent, { eventId: c.eventId });
    expect(await changePreview(c, "cancelled")).not.toBeNull();
    expect(await changePreview(c, "restored")).toBeNull();
  });

  it("restore offers nothing when the cancellation wasn't sent, and cancel without a fingerprint tells nobody", async () => {
    const c = await involvedSetup();
    await c.asAdmin.mutation(api.events.cancelEvent, { eventId: c.eventId });
    expect(await c.t.run((ctx) => ctx.db.query("actionNotices").collect())).toHaveLength(0);
    expect(await changePreview(c, "restored")).toBeNull();
  });

  it("sends a details change and clears dismissals on replacement; deleting the event removes the row", async () => {
    const c = await involvedSetup();
    const p = (await changePreview(c, "detailsChanged"))!;
    expect(p.title).toBe("Changed: Open day");
    await c.asAdmin.mutation(api.eventChangeNotices.sendEventChangeNotice, {
      eventId: c.eventId,
      kind: "detailsChanged",
      fingerprint: p.fingerprint,
    });
    const item = (await c.asBob.query(api.actionCentre.getMyActions, {})).find((a) => a.title === "Changed: Open day")!;
    await c.asBob.mutation(api.actionCentre.dismissAction, { actionId: item.id });

    const cancel = (await changePreview(c, "cancelled"))!;
    await c.asAdmin.mutation(api.events.cancelEvent, { eventId: c.eventId, notifyFingerprint: cancel.fingerprint });
    expect((await c.asBob.query(api.actionCentre.getMyActions, {})).some((a) => a.title === "Cancelled: Open day")).toBe(true);

    await c.asAdmin.mutation(api.events.deleteEvent, { eventId: c.eventId });
    expect(await c.t.run((ctx) => ctx.db.query("actionNotices").collect())).toHaveLength(0);
  });
});
