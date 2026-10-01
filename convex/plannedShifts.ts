import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { isMemberAccount } from "./lib/accountType";
import { brigadeDateStr, brigadeTimestamp } from "./lib/dates";
import {
  nextStatusValidator,
  plannedStatusValidator,
} from "./lib/statusValidators";

// Planned shifts: a member enters the shifts they work (e.g. a nursing roster)
// and is marked unavailable automatically while at work. A shift type holds the
// times; tapping a date stamps one shift on it. Each stamped shift schedules its
// own applyShift at its start, and the existing processStatusTransitions cron
// ends it via nextStatus/nextStatusAt. See docs/plans/planned-shifts-plan.md.

/** At most this many shift types per member. Also the palette size. */
export const MAX_SHIFT_TYPES = 6;
/** Guards against runaway data: pending shifts per member. */
export const MAX_PENDING_SHIFTS = 120;
/** How far ahead a shift can be stamped, in days (about 3 months). */
export const HORIZON_DAYS = 92;
/** Ended shifts older than this are deleted by the daily cleanup. */
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH = 500;
const MAX_NAME_LENGTH = 30;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const shiftStateValidator = v.union(
  v.literal("pending"),
  v.literal("applied"),
  v.literal("skipped"),
);

const shiftTypeReturn = v.object({
  _id: v.id("shiftTypes"),
  name: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  status: plannedStatusValidator,
  afterStatus: nextStatusValidator,
  colour: v.number(),
  // Lets the edit form say "updates 8 upcoming shifts".
  pendingCount: v.number(),
});

const plannedShiftReturn = v.object({
  _id: v.id("plannedShifts"),
  shiftTypeId: v.id("shiftTypes"),
  name: v.string(),
  colour: v.number(),
  status: plannedStatusValidator,
  afterStatus: nextStatusValidator,
  date: v.string(),
  startAt: v.number(),
  endAt: v.number(),
  state: shiftStateValidator,
});

const shiftTypeFields = {
  name: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  status: plannedStatusValidator,
  afterStatus: v.optional(nextStatusValidator),
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function parseTime(time: string): { hour: number; minute: number } {
  const match = TIME_PATTERN.exec(time);
  if (!match) throw new Error(`"${time}" isn't a valid time. Use HH:mm, e.g. 21:00.`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function parseDate(date: string): { year: number; month: number; day: number } {
  if (!DATE_PATTERN.test(date)) throw new Error(`"${date}" isn't a valid date.`);
  const [year, month, day] = date.split("-").map(Number);
  // Round-trip to reject 2026-02-31 and friends.
  const check = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  if (check !== date) throw new Error(`"${date}" isn't a valid date.`);
  return { year, month, day };
}

/** The YYYY-MM-DD date some days either side of another. */
function shiftDate(date: string, days: number): string {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * When a shift on a Melbourne date starts and ends, as instants. An end at or
 * before the start runs into the next day. Computed with brigadeTimestamp so a
 * shift spanning a daylight-saving change still keeps its wall-clock times.
 *
 * DST policy: a start between 02:00 and 03:00 on a changeover Sunday doesn't
 * exist (October) or happens twice (April). We accept whatever brigadeTimestamp
 * returns for that hour; plannedShifts.test.ts pins it.
 */
export function shiftInstants(
  date: string,
  startTime: string,
  endTime: string,
): { startAt: number; endAt: number } {
  const { year, month, day } = parseDate(date);
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const overnight =
    end.hour * 60 + end.minute <= start.hour * 60 + start.minute;
  const startAt = brigadeTimestamp(year, month, day, start.hour, start.minute);
  const endAt = brigadeTimestamp(
    year,
    month,
    day + (overnight ? 1 : 0),
    end.hour,
    end.minute,
  );
  return { startAt, endAt };
}

function overlaps(
  a: { startAt: number; endAt: number },
  b: { startAt: number; endAt: number },
): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

function validateShiftType(args: { name: string; startTime: string; endTime: string }) {
  const name = args.name.trim();
  if (!name) throw new Error("Give the shift a name, e.g. Night.");
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Keep the name to ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  parseTime(args.startTime);
  parseTime(args.endTime);
  // Start and end being different is the whole check for "at most 24 hours":
  // an end before the start means the next day, so the span is always shorter.
  if (args.startTime === args.endTime) {
    throw new Error("A shift can't start and end at the same time.");
  }
  return name;
}

/** "Mon 6 Oct" for error messages, read in Melbourne. */
function dateLabel(date: string): string {
  const { year, month, day } = parseDate(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = d.toLocaleDateString("en-AU", { weekday: "short", timeZone: "UTC" });
  const monthName = d.toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
  return `${weekday} ${day} ${monthName}`;
}

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

/** The signed-in member. Shared and disabled accounts have no roster. */
async function requireMember(ctx: MutationCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in to plan shifts.");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found.");
  if (!isMemberAccount(user)) {
    throw new Error("Planned shifts are only for member accounts.");
  }
  return user;
}

async function requireOwnShiftType(
  ctx: MutationCtx,
  userId: Id<"users">,
  id: Id<"shiftTypes">,
): Promise<Doc<"shiftTypes">> {
  const type = await ctx.db.get(id);
  if (!type || type.userId !== userId) throw new Error("Shift type not found.");
  return type;
}

async function shiftOnDate(
  ctx: QueryCtx,
  userId: Id<"users">,
  date: string,
): Promise<Doc<"plannedShifts"> | null> {
  return await ctx.db
    .query("plannedShifts")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", userId).eq("date", date))
    .first();
}

async function pendingShiftsOfType(ctx: QueryCtx, shiftTypeId: Id<"shiftTypes">) {
  return await ctx.db
    .query("plannedShifts")
    .withIndex("by_shiftTypeId_and_state", (q) =>
      q.eq("shiftTypeId", shiftTypeId).eq("state", "pending"),
    )
    .take(MAX_PENDING_SHIFTS + 1);
}

async function scheduleApply(
  ctx: MutationCtx,
  shiftId: Id<"plannedShifts">,
  startAt: number,
) {
  // A start in the past runs at once, which is what stamping an
  // already-started shift should do.
  await ctx.scheduler.runAt(startAt, internal.plannedShifts.applyShift, {
    shiftId,
    startAt,
  });
}

/**
 * The one way a shift leaves the calendar: removal, swap and list delete all
 * come through here. If the shift is in progress and the member's status is
 * still the one it set, the status is cleared too. If they've changed it since,
 * it's theirs and stays.
 */
async function removeShift(ctx: MutationCtx, shift: Doc<"plannedShifts">) {
  const now = Date.now();
  if (shift.state === "applied" && shift.startAt <= now && now < shift.endAt) {
    const user = await ctx.db.get(shift.userId);
    if (
      user &&
      user.statusExpiresAt === shift.endAt &&
      user.currentStatus === shift.status
    ) {
      await ctx.db.patch(user._id, {
        currentStatus: undefined,
        statusUpdatedAt: undefined,
        statusExpiresAt: undefined,
        statusDurationHours: undefined,
        nextStatus: undefined,
        nextStatusAt: undefined,
      });
    }
  }
  await ctx.db.delete(shift._id);
}

/** Throws naming the date if a shift at these times would overlap a neighbour. */
async function assertNoOverlap(
  ctx: QueryCtx,
  userId: Id<"users">,
  date: string,
  times: { startAt: number; endAt: number },
  // Shifts being moved in the same edit, with their new times.
  moving: Map<Id<"plannedShifts">, { startAt: number; endAt: number }> = new Map(),
) {
  for (const neighbourDate of [shiftDate(date, -1), shiftDate(date, 1)]) {
    const neighbour = await shiftOnDate(ctx, userId, neighbourDate);
    if (!neighbour) continue;
    const neighbourTimes = moving.get(neighbour._id) ?? neighbour;
    if (overlaps(times, neighbourTimes)) {
      throw new Error(
        `The shift on ${dateLabel(date)} would overlap the ${neighbour.name} shift on ${dateLabel(neighbourDate)}.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getMyShiftTypes = query({
  args: {},
  returns: v.array(shiftTypeReturn),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const types = await ctx.db
      .query("shiftTypes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(MAX_SHIFT_TYPES * 2);
    return await Promise.all(
      types.map(async (type) => ({
        _id: type._id,
        name: type.name,
        startTime: type.startTime,
        endTime: type.endTime,
        status: type.status,
        afterStatus: type.afterStatus,
        colour: type.colour,
        pendingCount: (await pendingShiftsOfType(ctx, type._id)).length,
      })),
    );
  },
});

/** The signed-in member's shifts with dates in [from, to], oldest first. */
export const getMyPlannedShifts = query({
  args: { from: v.string(), to: v.string() },
  returns: v.array(plannedShiftReturn),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    parseDate(args.from);
    parseDate(args.to);
    const shifts = await ctx.db
      .query("plannedShifts")
      .withIndex("by_userId_and_date", (q) =>
        q.eq("userId", userId).gte("date", args.from).lte("date", args.to),
      )
      // One per date, and the window is a few months at most.
      .take(400);
    return shifts.map((s) => ({
      _id: s._id,
      shiftTypeId: s.shiftTypeId,
      name: s.name,
      colour: s.colour,
      status: s.status,
      afterStatus: s.afterStatus,
      date: s.date,
      startAt: s.startAt,
      endAt: s.endAt,
      state: s.state,
    }));
  },
});

/**
 * Summary for the You tab: how many shifts are still to come and the next one.
 * Folded into getUserInfoForYouTab so the tab keeps a single subscription.
 */
export async function upcomingShiftSummary(ctx: QueryCtx, userId: Id<"users">) {
  // From yesterday, so an overnight shift that started yesterday is in range.
  const pending = (
    await ctx.db
      .query("plannedShifts")
      .withIndex("by_userId_and_date", (q) =>
        q.eq("userId", userId).gte("date", brigadeDateStr(-1)),
      )
      .take(MAX_PENDING_SHIFTS * 2)
  ).filter((s) => s.state === "pending");
  const next = pending[0];
  return {
    upcomingCount: pending.length,
    next: next
      ? { name: next.name, status: next.status, startAt: next.startAt, endAt: next.endAt }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const createShiftType = mutation({
  args: shiftTypeFields,
  returns: v.id("shiftTypes"),
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    const name = validateShiftType(args);
    const existing = await ctx.db
      .query("shiftTypes")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_SHIFT_TYPES + 1);
    if (existing.length >= MAX_SHIFT_TYPES) {
      throw new Error(`You can have up to ${MAX_SHIFT_TYPES} shift types.`);
    }
    // First palette colour no other type is using.
    const used = new Set(existing.map((t) => t.colour));
    let colour = 0;
    while (used.has(colour) && colour < MAX_SHIFT_TYPES - 1) colour++;

    return await ctx.db.insert("shiftTypes", {
      userId: user._id,
      name,
      startTime: args.startTime,
      endTime: args.endTime,
      status: args.status,
      afterStatus: args.afterStatus ?? "reset",
      colour,
    });
  },
});

/**
 * Edit a shift type. Its pending shifts follow it, since editing is how a
 * member corrects a mistake: new times, name and statuses, and a fresh
 * applyShift job (the old one finds startAt changed and does nothing).
 * Applied and skipped shifts keep what they did. The whole edit is rejected
 * if any moved shift would overlap a neighbour.
 */
export const updateShiftType = mutation({
  args: { id: v.id("shiftTypes"), ...shiftTypeFields },
  returns: v.object({ restamped: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    const type = await requireOwnShiftType(ctx, user._id, args.id);
    const name = validateShiftType(args);
    const afterStatus = args.afterStatus ?? type.afterStatus;

    await ctx.db.patch(type._id, {
      name,
      startTime: args.startTime,
      endTime: args.endTime,
      status: args.status,
      afterStatus,
    });

    const pending = await pendingShiftsOfType(ctx, type._id);
    const moving = new Map(
      pending.map((s) => [s._id, shiftInstants(s.date, args.startTime, args.endTime)]),
    );
    for (const shift of pending) {
      await assertNoOverlap(ctx, user._id, shift.date, moving.get(shift._id)!, moving);
    }

    for (const shift of pending) {
      const times = moving.get(shift._id)!;
      await ctx.db.patch(shift._id, {
        name,
        status: args.status,
        afterStatus,
        startAt: times.startAt,
        endAt: times.endAt,
      });
      if (times.startAt !== shift.startAt) {
        await scheduleApply(ctx, shift._id, times.startAt);
      }
    }
    return { restamped: pending.length };
  },
});

/** Delete a shift type. Shifts already on the calendar stay. */
export const deleteShiftType = mutation({
  args: { id: v.id("shiftTypes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    const type = await requireOwnShiftType(ctx, user._id, args.id);
    await ctx.db.delete(type._id);
    return null;
  },
});

/**
 * Tap a date: add the type's shift if the date is empty, remove it if the date
 * already holds this type, or swap if it holds another. One shift per date.
 */
export const toggleShiftOnDate = mutation({
  args: { date: v.string(), shiftTypeId: v.id("shiftTypes") },
  returns: v.union(v.literal("added"), v.literal("removed"), v.literal("swapped")),
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    const type = await requireOwnShiftType(ctx, user._id, args.shiftTypeId);
    parseDate(args.date);
    const today = brigadeDateStr();
    if (args.date < today) throw new Error("That date has passed.");
    if (args.date > brigadeDateStr(HORIZON_DAYS)) {
      throw new Error("Shifts can be planned up to 3 months ahead.");
    }

    const existing = await shiftOnDate(ctx, user._id, args.date);
    if (existing && existing.shiftTypeId === type._id) {
      await removeShift(ctx, existing);
      return "removed";
    }

    const times = shiftInstants(args.date, type.startTime, type.endTime);
    await assertNoOverlap(ctx, user._id, args.date, times);

    if (existing) {
      await removeShift(ctx, existing);
    } else {
      const pending = (
        await ctx.db
          .query("plannedShifts")
          .withIndex("by_userId_and_date", (q) =>
            q.eq("userId", user._id).gte("date", today),
          )
          .take(MAX_PENDING_SHIFTS * 2)
      ).filter((s) => s.state === "pending");
      if (pending.length >= MAX_PENDING_SHIFTS) {
        throw new Error(`You can have up to ${MAX_PENDING_SHIFTS} upcoming shifts.`);
      }
    }

    const shiftId = await ctx.db.insert("plannedShifts", {
      userId: user._id,
      shiftTypeId: type._id,
      name: type.name,
      colour: type.colour,
      status: type.status,
      afterStatus: type.afterStatus,
      date: args.date,
      startAt: times.startAt,
      endAt: times.endAt,
      state: "pending",
    });
    await scheduleApply(ctx, shiftId, times.startAt);
    return existing ? "swapped" : "added";
  },
});

export const removePlannedShift = mutation({
  args: { id: v.id("plannedShifts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireMember(ctx);
    const shift = await ctx.db.get(args.id);
    if (!shift || shift.userId !== user._id) throw new Error("Shift not found.");
    await removeShift(ctx, shift);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Run by the scheduler at a shift's start. Sets the member's status exactly as
 * Add Duration would, with the shift's end as the expiry and its after-status
 * as nextStatus, so processStatusTransitions ends it. Nothing is ever
 * cancelled: a job for a shift that has gone, already ran, or moved since it
 * was scheduled does nothing.
 */
export const applyShift = internalMutation({
  args: { shiftId: v.id("plannedShifts"), startAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.state !== "pending" || shift.startAt !== args.startAt) {
      return null;
    }
    const now = Date.now();
    const skip = async () => {
      await ctx.db.patch(shift._id, { state: "skipped" });
      return null;
    };

    // Added late, or the backend was down for the whole shift.
    if (shift.endAt <= now) return await skip();

    const user = await ctx.db.get(shift.userId);
    if (!user || !isMemberAccount(user)) return await skip();

    // A status the member set to run past this shift (e.g. "not available"
    // for 3 days) wins: don't shorten it. A status with no expiry never
    // blocks, or yesterday's after-shift status would block today's shift.
    if (user.currentStatus && user.statusExpiresAt && user.statusExpiresAt >= shift.endAt) {
      return await skip();
    }

    await ctx.db.patch(user._id, {
      currentStatus: shift.status,
      statusUpdatedAt: now,
      statusExpiresAt: shift.endAt,
      statusDurationHours: Math.round(((shift.endAt - now) / 3_600_000) * 100) / 100,
      nextStatus: shift.afterStatus,
      nextStatusAt: shift.endAt,
    });
    await ctx.db.insert("memberStatusHistory", {
      userId: user._id,
      status: shift.status,
      timestamp: now,
    });
    await ctx.db.patch(shift._id, { state: "applied" });
    return null;
  },
});

/**
 * Daily: delete shifts that ended more than a week ago. memberStatusHistory
 * already records what they did, so they have no historical value.
 */
export const cleanupOldPlannedShifts = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;
    const old = await ctx.db
      .query("plannedShifts")
      .withIndex("by_endAt", (q) => q.lt("endAt", cutoff))
      .take(CLEANUP_BATCH);
    for (const shift of old) {
      await ctx.db.delete(shift._id);
    }
    if (old.length === CLEANUP_BATCH) {
      await ctx.scheduler.runAfter(0, internal.plannedShifts.cleanupOldPlannedShifts, {});
    }
    return old.length;
  },
});

/** Remove every shift type and shift a member has. Used by deleteUser. */
export async function deletePlannedShiftsForUser(ctx: MutationCtx, userId: Id<"users">) {
  const types = await ctx.db
    .query("shiftTypes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const type of types) await ctx.db.delete(type._id);
  // Any applyShift still scheduled finds no shift and does nothing.
  const shifts = await ctx.db
    .query("plannedShifts")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", userId))
    .collect();
  for (const shift of shifts) await ctx.db.delete(shift._id);
}
