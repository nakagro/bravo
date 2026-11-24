import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isMemberAccount } from "./lib/accountType";
import { brigadeDateStr } from "./lib/dates";

// Test fixtures for UAT only: `npm run uat:test-event`.
//
// Three locks keep this off prod:
//  1. internalMutation - no browser can call it, only the CLI/dashboard with
//     the deployment's admin key;
//  2. the npm script targets the UAT deployment;
//  3. assertUat below refuses unless UAT_DEPLOYMENT is set on the deployment
//     and matches Convex's own CONVEX_CLOUD_URL.
//
// Rows are inserted directly, so nothing is pushed or emailed. Everything it
// makes is titled "[TEST] ..." and can be cancelled and deleted in the app.

export const TEST_TITLE_PREFIX = "[TEST]";

function assertUat() {
  const expected = process.env.UAT_DEPLOYMENT?.trim() ?? "";
  const url = process.env.CONVEX_CLOUD_URL ?? "";
  if (!expected || !url.includes(expected)) {
    throw new Error(`Refusing to run: this is not the UAT deployment (${url || "unknown"})`);
  }
}

const SHIFTS = [
  { label: "Morning", startTime: "08:00", endTime: "12:00", targetCount: 5 },
  { label: "Afternoon", startTime: "12:00", endTime: "16:00", targetCount: 5 },
  { label: "Evening", startTime: "16:00", endTime: "20:00", targetCount: 4 },
];

/** Fisher-Yates on a copy. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A shift event that looks lived-in: three shifts, about 20 members with a
 * spread of answers (going, maybe, can't make it, interest in one or several
 * shifts), the morning shift already rostered and the rest not, and a Pumper
 * crewed per shift with empty seats.
 */
export const createTestEvent = internalMutation({
  args: {
    title: v.optional(v.string()),
    /** YYYY-MM-DD; default a week from today */
    date: v.optional(v.string()),
    /** Who organises it; default the first admin */
    organiserEmail: v.optional(v.string()),
    /** How many members to give answers to; default 20 */
    people: v.optional(v.number()),
  },
  returns: v.object({ eventId: v.id("events"), title: v.string(), date: v.string(), people: v.number() }),
  handler: async (ctx, args) => {
    assertUat();

    const users = (await ctx.db.query("users").take(1000)).filter(isMemberAccount);
    const organiser: Doc<"users"> | undefined = args.organiserEmail
      ? users.find((u) => u.email?.toLowerCase() === args.organiserEmail!.toLowerCase())
      : users.find((u) => u.isAdmin);
    if (!organiser) throw new Error("No organiser found - pass organiserEmail");

    const pool = shuffled(users.filter((u) => u._id !== organiser._id)).slice(0, args.people ?? 20);
    if (pool.length < 6) throw new Error("Not enough members on UAT to fill a test event");

    const now = Date.now();
    const date = args.date ?? brigadeDateStr(7);
    const title = `${TEST_TITLE_PREFIX} ${args.title?.trim() || "Station crewing day"}`;

    const eventId = await ctx.db.insert("events", {
      title,
      description: "Made by npm run uat:test-event. Safe to change or delete.",
      location: "Main Station",
      status: "active",
      startDate: date,
      startTime: "08:00",
      endTime: "20:00",
      isAllDay: false,
      hasShifts: true,
      createdBy: organiser._id,
      createdAt: now,
      updatedAt: now,
    });

    const slotIds: Id<"eventSlots">[] = [];
    for (const [order, shift] of SHIFTS.entries()) {
      slotIds.push(
        await ctx.db.insert("eventSlots", { eventId, ...shift, order, createdAt: now, updatedAt: now })
      );
    }

    // The spread: ~10% can't make it, ~15% maybe, the rest going. Going and
    // maybe members offer for one shift, or two, or all three.
    const morningInterested: Id<"users">[] = [];
    for (const [i, user] of pool.entries()) {
      const share = i / pool.length;
      const status = share < 0.1 ? "notAttending" : share < 0.25 ? "maybe" : "attending";
      await ctx.db.insert("eventRsvps", { eventId, userId: user._id, status, createdAt: now, updatedAt: now });
      if (status === "notAttending") continue;

      const picks = shuffled(slotIds).slice(0, 1 + (i % 3));
      for (const slotId of picks) {
        await ctx.db.insert("eventSlotResponses", { eventId, slotId, userId: user._id, createdAt: now });
        if (slotId === slotIds[0]) morningInterested.push(user._id);
      }
    }

    // Morning already rostered from its interest, so both board states show
    for (const userId of morningInterested.slice(0, SHIFTS[0].targetCount)) {
      await ctx.db.insert("eventSlotAllocations", {
        eventId,
        slotId: slotIds[0],
        userId,
        assignedBy: organiser._id,
        createdAt: now,
      });
    }

    await ctx.db.insert("eventCrews", {
      eventId,
      applianceName: "Brigade Pumper",
      perShift: true,
      crewMembers: [],
      createdBy: organiser._id,
      updatedBy: organiser._id,
      updatedAt: now,
    });

    await ctx.db.insert("eventHistory", {
      eventId,
      timestamp: now,
      userId: organiser._id,
      changeType: "event_created",
      field: "event",
      oldValue: null,
      newValue: title,
    });

    return { eventId, title, date, people: pool.length };
  },
});
