import { query, mutation, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { isMemberAccount } from "./lib/accountType";
import { moduleSettingAllows } from "./modules";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireSignedIn(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in");
  return userId;
}

/**
 * Require access to the `eventsAdmin` module (Lieutenant+ by default).
 * The gate lives in moduleSettings data so admins can retune it from the
 * Admin UI without code changes. Admins always pass.
 */
export async function requireEventsAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await requireSignedIn(ctx);
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");

  if (user.isAdmin) return userId;

  const moduleSetting = await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", "eventsAdmin"))
    .first();

  if (!moduleSettingAllows(user, moduleSetting)) {
    throw new Error("You do not have access to manage events");
  }

  return userId;
}

/**
 * Non-throwing variant of requireEventsAdmin for queries that should
 * return empty results rather than error when unauthorised.
 */
export async function hasEventsAdmin(ctx: QueryCtx): Promise<Id<"users"> | null> {
  try {
    return await requireEventsAdmin(ctx);
  } catch {
    return null;
  }
}

/**
 * Who is trusted with *this* event: the brigade-wide eventsAdmin holders plus
 * the two per-event roles - the organiser (`createdBy`) and anyone named as a
 * team leader.
 *
 * The per-event roles exist because running an event on the day and holding an
 * officer rank or the Social Admin role are different things. A team leader gets
 * the organiser's toolkit for one event only: edit, roster, open/close
 * responses, notify, cancel, and the full response breakdown. It is never a
 * route to brigade-wide access - the Admin tab, creating events, event types and
 * permanent deletion all stay on `requireEventsAdmin`.
 */
export function isEventTeamLeader(event: Doc<"events">, userId: Id<"users">): boolean {
  return event.teamLeaderIds?.includes(userId) ?? false;
}

/**
 * Non-throwing per-event permission check. Returns the signed-in user id when
 * they may manage this event, otherwise null.
 */
export async function eventManagerId(
  ctx: QueryCtx,
  event: Doc<"events">
): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  if (event.createdBy === userId || isEventTeamLeader(event, userId)) return userId;
  return await hasEventsAdmin(ctx);
}

/**
 * Throwing variant, used by the mutations a team leader is allowed to run.
 * Loads the event too, since every caller needs it.
 */
export async function requireEventManager(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">
): Promise<{ userId: Id<"users">; event: Doc<"events"> }> {
  const signedInId = await requireSignedIn(ctx);
  const event = await ctx.db.get(eventId);
  if (!event) throw new Error("Event not found");

  if (event.createdBy === signedInId || isEventTeamLeader(event, signedInId)) {
    return { userId: signedInId, event };
  }

  return { userId: await requireEventsAdmin(ctx), event };
}

// Today as a YYYY-MM-DD string in AEST (same hardcoded UTC+10 assumption as
// crons.ts - drifts 1h during AEDT, accepted)
function aestTodayStr(): string {
  return new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const rsvpStatusValidator = v.union(
  v.literal("attending"),
  v.literal("notAttending"),
  v.literal("maybe")
);

const userNameValidator = v.object({
  _id: v.id("users"),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  name: v.optional(v.string()),
});

const enrichedEventValidator = v.object({
  _id: v.id("events"),
  _creationTime: v.number(),
  title: v.string(),
  description: v.optional(v.string()),
  eventType: v.optional(v.string()),
  eventTypeId: v.optional(v.id("eventTypes")),
  location: v.optional(v.string()),
  address: v.optional(v.string()),
  status: v.union(v.literal("active"), v.literal("cancelled")),
  startDate: v.string(),
  endDate: v.optional(v.string()),
  startTime: v.optional(v.string()),
  endTime: v.optional(v.string()),
  respondBy: v.optional(v.string()),
  hasShifts: v.optional(v.boolean()),
  memberResponses: v.optional(v.union(v.literal("open"), v.literal("closed"))),
  isAllDay: v.boolean(),
  cancelledBy: v.optional(v.id("users")),
  cancelledAt: v.optional(v.number()),
  cancellationReason: v.optional(v.string()),
  createdBy: v.id("users"),
  teamLeaderIds: v.optional(v.array(v.id("users"))),
  createdAt: v.number(),
  updatedAt: v.number(),
  counts: v.object({
    attending: v.number(),
    notAttending: v.number(),
    maybe: v.number(),
  }),
  myRsvp: v.union(rsvpStatusValidator, v.null()),
  createdByUser: v.optional(userNameValidator),
  // Named team leaders, resolved to names for display. Deleted members drop out.
  teamLeaders: v.array(userNameValidator),
  // Whether *the caller* may manage this event - eventsAdmin, the organiser, or a
  // team leader. The flag every event-scoped admin control hangs off, so the
  // client never has to re-derive the rule.
  canManage: v.boolean(),
  // Whether the caller is one of the team leaders - drives the badge that tells
  // them (and only them) that this is an event they're running.
  iAmTeamLeader: v.boolean(),
  // Whether the caller has been *allocated* (rostered), as opposed to having
  // only offered. Both read as "attending" in myRsvp, but they're different
  // things to say to the member: one is an answer, the other is a commitment.
  iAmRostered: v.boolean(),
  // Naming team leaders is the organiser's / eventsAdmin's call, never a team
  // leader's - the role must not be able to widen itself.
  canAppointLeaders: v.boolean(),
  // Permanent deletion stays brigade-wide eventsAdmin: it's irreversible, and
  // running one event isn't a mandate to erase its record.
  canDelete: v.boolean(),
  // Resolved category (name + colour) from eventTypeId; null when unset/deleted
  eventTypeInfo: v.union(
    v.object({
      _id: v.id("eventTypes"),
      name: v.string(),
      color: v.string(),
    }),
    v.null()
  ),
});

/**
 * Whether members may still opt *in* to an event. Absent means open, so every
 * event that predates the field keeps behaving exactly as before.
 */
export function responsesAreOpen(event: Doc<"events">): boolean {
  return (event.memberResponses ?? "open") !== "closed";
}

/**
 * Who counts as going to an event, and who has declined.
 *
 * The roster (eventSlotAllocations) is always authoritative and always counts,
 * for shift and shiftless events alike. Member-expressed responses - a shift
 * pick, or an "attending" rsvp - only count while responses are open. That's
 * what makes closing and reopening non-destructive: the rows stay exactly where
 * they are, they just stop being consulted while the organiser owns the list.
 *
 * A "can't make it" always wins, even over a placement. A rostered decliner is
 * a conflict for the organiser to resolve, not a head to count - which is why
 * declining stays available even when responses are closed.
 */
async function attendanceFor(
  ctx: QueryCtx,
  event: Doc<"events">
): Promise<{
  going: Set<Id<"users">>;
  // The official roster alone - a subset of `going`, and the difference between
  // "I've offered" and "I've been given a shift"
  rostered: Set<Id<"users">>;
  declined: Set<Id<"users">>;
  rsvps: Doc<"eventRsvps">[];
}> {
  const [rsvps, allocations] = await Promise.all([
    ctx.db
      .query("eventRsvps")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect(),
    ctx.db
      .query("eventSlotAllocations")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect(),
  ]);

  const rostered = new Set<Id<"users">>(allocations.map((a) => a.userId));
  const going = new Set<Id<"users">>(rostered);

  if (responsesAreOpen(event)) {
    if (event.hasShifts) {
      const interest = await ctx.db
        .query("eventSlotResponses")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();
      for (const r of interest) going.add(r.userId);
    } else {
      for (const r of rsvps) {
        if (r.status === "attending") going.add(r.userId);
      }
    }
  }

  const declined = new Set(
    rsvps.filter((r) => r.status === "notAttending").map((r) => r.userId)
  );
  for (const id of declined) going.delete(id);

  return { going, rostered, declined, rsvps };
}

/**
 * `viewerIsAdmin` is passed in rather than derived per event: it's the same
 * answer for every row in a list, and deriving it costs a user + moduleSettings
 * read each time.
 */
async function enrichEvent(
  ctx: QueryCtx,
  event: Doc<"events">,
  userId: Id<"users">,
  viewerIsAdmin: boolean
) {
  const { going, rostered, declined, rsvps } = await attendanceFor(ctx, event);

  const counts = { attending: going.size, notAttending: declined.size, maybe: 0 };
  let myRsvp: "attending" | "notAttending" | "maybe" | null = null;

  if (declined.has(userId)) {
    myRsvp = "notAttending";
  } else if (going.has(userId)) {
    myRsvp = "attending";
  }

  // "Maybe" only exists on a plain open RSVP event - a shift event answers with
  // a slot pick, and a closed event isn't asking. Stale maybes stay in the
  // table either way, ready to count again if the event reopens.
  if (!event.hasShifts && responsesAreOpen(event)) {
    for (const rsvp of rsvps) {
      if (rsvp.status !== "maybe") continue;
      counts.maybe++;
      if (rsvp.userId === userId) myRsvp = "maybe";
    }
  }

  const createdByUser = await ctx.db.get(event.createdBy);

  const teamLeaders = (await Promise.all((event.teamLeaderIds ?? []).map((id) => ctx.db.get(id))))
    .filter((user): user is Doc<"users"> => user !== null)
    .map((user) => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
    }));

  let eventTypeInfo: { _id: Id<"eventTypes">; name: string; color: string } | null = null;
  if (event.eventTypeId) {
    const type = await ctx.db.get(event.eventTypeId);
    if (type) {
      eventTypeInfo = { _id: type._id, name: type.name, color: type.color };
    }
  }

  return {
    ...event,
    counts,
    myRsvp,
    eventTypeInfo,
    teamLeaders,
    canManage: viewerIsAdmin || event.createdBy === userId || isEventTeamLeader(event, userId),
    iAmTeamLeader: isEventTeamLeader(event, userId),
    iAmRostered: rostered.has(userId),
    canAppointLeaders: viewerIsAdmin || event.createdBy === userId,
    canDelete: viewerIsAdmin,
    createdByUser: createdByUser
      ? {
          _id: createdByUser._id,
          firstName: createdByUser.firstName,
          lastName: createdByUser.lastName,
          name: createdByUser.name,
        }
      : undefined,
  };
}

async function recordHistory(
  ctx: MutationCtx,
  entry: {
    eventId: Id<"events">;
    userId: Id<"users">;
    changeType: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    notes?: string;
  }
) {
  await ctx.db.insert("eventHistory", {
    eventId: entry.eventId,
    timestamp: Date.now(),
    userId: entry.userId,
    changeType: entry.changeType,
    field: entry.field,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    notes: entry.notes,
  });
}

// Slot definition as sent by the event form. `_id` present = existing slot to
// patch; absent = new slot to insert.
const slotInputValidator = v.object({
  _id: v.optional(v.id("eventSlots")),
  label: v.string(),
  startTime: v.optional(v.string()),
  endTime: v.optional(v.string()),
  date: v.optional(v.string()),
  targetCount: v.optional(v.number()),
});

type SlotInput = {
  _id?: Id<"eventSlots">;
  label: string;
  startTime?: string;
  endTime?: string;
  date?: string;
  targetCount?: number;
};

/**
 * Move every slot allocation on an event up to the event level, deduped per
 * member, so turning shifts off keeps the roster the organiser already built
 * instead of silently emptying it. The people stay on; only the shift they were
 * placed in - which no longer exists - is lost.
 */
async function liftAllocationsToEventLevel(ctx: MutationCtx, eventId: Id<"events">) {
  const allocations = await ctx.db
    .query("eventSlotAllocations")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect();

  const seen = new Set<Id<"users">>();
  for (const allocation of allocations) {
    if (seen.has(allocation.userId)) {
      // A member rostered across several shifts collapses to one placement
      await ctx.db.delete(allocation._id);
      continue;
    }
    seen.add(allocation.userId);
    if (allocation.slotId !== undefined) {
      await ctx.db.patch(allocation._id, { slotId: undefined });
    }
  }
}

/**
 * Reconcile an event's slots to the desired list (insert new, patch existing by
 * _id, delete removed). Deleting a slot cascade-deletes its interest *and* its
 * allocations - an allocation to a slot that no longer exists would otherwise
 * linger as an invisible attendee. Slot order follows array order.
 */
async function reconcileSlots(
  ctx: MutationCtx,
  eventId: Id<"events">,
  slots: SlotInput[]
) {
  const existing = await ctx.db
    .query("eventSlots")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect();

  const keepIds = new Set(slots.filter((s) => s._id).map((s) => s._id as Id<"eventSlots">));

  // Delete slots the organiser removed, plus their responses and allocations
  for (const slot of existing) {
    if (!keepIds.has(slot._id)) {
      const [responses, allocations] = await Promise.all([
        ctx.db
          .query("eventSlotResponses")
          .withIndex("by_slot", (q) => q.eq("slotId", slot._id))
          .collect(),
        ctx.db
          .query("eventSlotAllocations")
          .withIndex("by_slot", (q) => q.eq("slotId", slot._id))
          .collect(),
      ]);
      for (const row of [...responses, ...allocations]) {
        await ctx.db.delete(row._id);
      }
      await ctx.db.delete(slot._id);
    }
  }

  const now = Date.now();
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const fields = {
      label: slot.label,
      startTime: slot.startTime,
      endTime: slot.endTime,
      date: slot.date,
      targetCount: slot.targetCount,
      order: i,
    };
    if (slot._id) {
      await ctx.db.patch(slot._id, { ...fields, updatedAt: now });
    } else {
      await ctx.db.insert("eventSlots", { eventId, ...fields, createdAt: now, updatedAt: now });
    }
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Get upcoming events (startDate >= fromDate), ascending, enriched with RSVP
 * counts and the caller's own RSVP. Includes cancelled events (UI badges them).
 */
export const getUpcomingEvents = query({
  args: { fromDate: v.string() },
  returns: v.array(enrichedEventValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const viewerIsAdmin = (await hasEventsAdmin(ctx)) !== null;

    const events = await ctx.db
      .query("events")
      .withIndex("by_startDate", (q) => q.gte("startDate", args.fromDate))
      .order("asc")
      .collect();

    return await Promise.all(events.map((event) => enrichEvent(ctx, event, userId, viewerIsAdmin)));
  },
});

/**
 * Get the 50 most recent past events (startDate < beforeDate), descending,
 * as an attendance record.
 */
export const getPastEvents = query({
  args: { beforeDate: v.string() },
  returns: v.array(enrichedEventValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const viewerIsAdmin = (await hasEventsAdmin(ctx)) !== null;

    const events = await ctx.db
      .query("events")
      .withIndex("by_startDate", (q) => q.lt("startDate", args.beforeDate))
      .order("desc")
      .take(50);

    return await Promise.all(events.map((event) => enrichEvent(ctx, event, userId, viewerIsAdmin)));
  },
});

/**
 * Paginated past-events archive for the admin tab (recollection / auditing).
 * Unlike getPastEvents (capped at 50), this reaches the full history via
 * cursor pagination. An optional `search` term matches the title via a search
 * index; future matches are dropped so the result stays "past only".
 */
export const getPastEventsPaged = query({
  args: {
    paginationOpts: paginationOptsValidator,
    beforeDate: v.string(),
    search: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(enrichedEventValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const viewerIsAdmin = (await hasEventsAdmin(ctx)) !== null;

    const term = args.search?.trim();

    if (term) {
      // Search index can't express the "past only" date range, so we match on
      // title and filter future events out of each page after the fact.
      const result = await ctx.db
        .query("events")
        .withSearchIndex("search_title", (q) => q.search("title", term))
        .paginate(args.paginationOpts);
      const past = result.page.filter((event) => event.startDate < args.beforeDate);
      const page = await Promise.all(past.map((event) => enrichEvent(ctx, event, userId, viewerIsAdmin)));
      return { page, isDone: result.isDone, continueCursor: result.continueCursor };
    }

    const result = await ctx.db
      .query("events")
      .withIndex("by_startDate", (q) => q.lt("startDate", args.beforeDate))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(result.page.map((event) => enrichEvent(ctx, event, userId, viewerIsAdmin)));
    return { page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

/**
 * Get a single enriched event (detail dialog / ?event= deep link).
 */
export const getEvent = query({
  args: { eventId: v.id("events") },
  returns: v.union(enrichedEventValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return null;
    }

    const viewerIsAdmin = (await hasEventsAdmin(ctx)) !== null;

    return await enrichEvent(ctx, event, userId, viewerIsAdmin);
  },
});

/**
 * Attendance for an event. The *attending* list is visible to every signed-in
 * member (it's a turnout tool). The full breakdown - maybe / not going / and
 * especially the non-responders - is sensitive, so it's returned only to
 * eventsAdmin (`breakdown` is null otherwise).
 */
export const getEventAttendance = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.object({
      attending: v.array(userNameValidator),
      // Members placed on the event itself rather than a shift. Only ever
      // non-empty on a shift event (where they'd otherwise be invisible,
      // appearing in no shift's roster); the shiftless list is just `attending`.
      rosteredNoShift: v.array(userNameValidator),
      breakdown: v.union(
        v.object({
          maybe: v.array(userNameValidator),
          notAttending: v.array(userNameValidator),
          noResponse: v.array(userNameValidator),
          totalMembers: v.number(),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return null;
    }

    const { going: attendingIds, rsvps } = await attendanceFor(ctx, event);

    const nameOf = (user: Doc<"users">) => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
    });

    // Attending list - visible to all signed-in members
    const attending = (
      await Promise.all([...attendingIds].map((id) => ctx.db.get(id)))
    )
      // A shared account with a stale RSVP or slot allocation is still not a
      // member, so it must not show up in the attending list either.
      .filter((user): user is Doc<"users"> => user !== null && isMemberAccount(user))
      .map(nameOf);

    const eventLevelIds = new Set(
      (
        await ctx.db
          .query("eventSlotAllocations")
          .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
          .collect()
      )
        .filter((allocation) => allocation.slotId === undefined)
        .map((allocation) => allocation.userId)
    );
    const rosteredNoShift = event.hasShifts
      ? attending.filter((member) => eventLevelIds.has(member._id))
      : [];

    // The full breakdown (incl. non-responders) is for whoever is running this
    // event - eventsAdmin, the organiser, or a named team leader.
    if ((await eventManagerId(ctx, event)) === null) {
      return { attending, rosteredNoShift, breakdown: null };
    }

    const rsvpByUser = new Map(rsvps.map((rsvp) => [rsvp.userId, rsvp.status]));
    // "All members" = all member users rows (no isActive flag, per bookings.getAllUsers).
    // Shared accounts would otherwise inflate totalMembers and sit in noResponse forever.
    const users = (await ctx.db.query("users").collect()).filter(isMemberAccount);

    const maybe: Array<ReturnType<typeof nameOf>> = [];
    const notAttending: Array<ReturnType<typeof nameOf>> = [];
    const noResponse: Array<ReturnType<typeof nameOf>> = [];

    // A "maybe" is only a live answer on an open, shiftless event. Elsewhere the
    // row may still exist (a leftover from before the event was closed, or from
    // before shifts were turned on) but it isn't an answer to the question being
    // asked, so those members read as not having responded.
    const maybeCounts = !event.hasShifts && responsesAreOpen(event);

    for (const user of users) {
      // Going members are already listed above - never double-count them below
      if (attendingIds.has(user._id)) continue;
      const status = rsvpByUser.get(user._id);
      if (status === "notAttending") notAttending.push(nameOf(user));
      else if (status === "maybe" && maybeCounts) maybe.push(nameOf(user));
      else if (status !== "attending") noResponse.push(nameOf(user));
    }

    return {
      attending,
      rosteredNoShift,
      breakdown: { maybe, notAttending, noResponse, totalMembers: users.length },
    };
  },
});

/**
 * Get the audit trail for an event with user names. Gated to eventsAdmin.
 */
export const getEventHistory = query({
  args: { eventId: v.id("events") },
  returns: v.array(
    v.object({
      _id: v.id("eventHistory"),
      _creationTime: v.number(),
      eventId: v.id("events"),
      timestamp: v.number(),
      userId: v.id("users"),
      changeType: v.string(),
      field: v.string(),
      oldValue: v.any(),
      newValue: v.any(),
      notes: v.optional(v.string()),
      user: v.optional(userNameValidator),
    })
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || (await eventManagerId(ctx, event)) === null) {
      return [];
    }

    const history = await ctx.db
      .query("eventHistory")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .order("desc")
      .collect();

    return await Promise.all(
      history.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          ...entry,
          user: user
            ? {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: user.name,
              }
            : undefined,
        };
      })
    );
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Create a new event (publishes immediately - no draft state).
 */
export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    eventTypeId: v.optional(v.id("eventTypes")),
    location: v.optional(v.string()),
    address: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    respondBy: v.optional(v.string()),
    hasShifts: v.optional(v.boolean()),
    memberResponses: v.optional(v.union(v.literal("open"), v.literal("closed"))),
    slots: v.optional(v.array(slotInputValidator)),
    isAllDay: v.boolean(),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const userId = await requireEventsAdmin(ctx);

    const now = Date.now();
    const eventId = await ctx.db.insert("events", {
      title: args.title,
      description: args.description,
      eventTypeId: args.eventTypeId,
      location: args.location,
      address: args.address,
      status: "active",
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.startTime,
      endTime: args.endTime,
      respondBy: args.respondBy,
      hasShifts: args.hasShifts,
      memberResponses: args.memberResponses,
      isAllDay: args.isAllDay,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    if (args.hasShifts && args.slots && args.slots.length > 0) {
      await reconcileSlots(ctx, eventId, args.slots);
    }

    await recordHistory(ctx, {
      eventId,
      userId,
      changeType: "event_created",
      field: "event",
      oldValue: null,
      newValue: args.title,
    });

    return eventId;
  },
});

/**
 * Update an event with a per-field audit trail. If startDate changes, the
 * reminder guard is cleared so rescheduled events get a fresh reminder.
 */
export const updateEvent = mutation({
  args: {
    eventId: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    // "" clears the category back to none (Id otherwise)
    eventTypeId: v.optional(v.union(v.id("eventTypes"), v.literal(""))),
    location: v.optional(v.string()),
    address: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    respondBy: v.optional(v.string()),
    hasShifts: v.optional(v.boolean()),
    slots: v.optional(v.array(slotInputValidator)),
    isAllDay: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, event } = await requireEventManager(ctx, args.eventId);

    const fields = [
      "title",
      "description",
      "eventTypeId",
      "location",
      "address",
      "startDate",
      "endDate",
      "startTime",
      "endTime",
      "respondBy",
      "hasShifts",
      "isAllDay",
    ] as const;

    const updateData: Record<string, unknown> = {};

    for (const field of fields) {
      let newValue: unknown = args[field];
      if (newValue === undefined) continue; // not provided → no change
      // Empty string clears an optional field (bookings convention);
      // required fields can't be blanked
      if (newValue === "") {
        if (field === "title" || field === "startDate") continue;
        newValue = undefined;
      }
      const oldValue = event[field];
      if (newValue === oldValue) continue;

      updateData[field] = newValue;
      await recordHistory(ctx, {
        eventId: args.eventId,
        userId,
        changeType: "field_change",
        field,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
      });
    }

    // Reconcile slots whenever the form sends them (independent of column
    // changes - a slot-only edit must still apply).
    if (args.slots !== undefined) {
      const hasShifts = args.hasShifts ?? event.hasShifts ?? false;
      // Turning shifts off drops the slots, so lift the roster to the event
      // first - otherwise the cascade would take the organiser's placements
      // with it and an event with known attendees would empty itself.
      if (!hasShifts && event.hasShifts) {
        await liftAllocationsToEventLevel(ctx, args.eventId);
      }
      // Turning shifts off clears all slots; otherwise sync to the payload.
      await reconcileSlots(ctx, args.eventId, hasShifts ? args.slots : []);
    }

    if (Object.keys(updateData).length === 0) {
      return null;
    }

    updateData.updatedAt = Date.now();

    await ctx.db.patch(args.eventId, updateData);
    return null;
  },
});

/**
 * Name the team leaders for an event - the members trusted to run this one event
 * without holding brigade-wide eventsAdmin.
 *
 * Appointment is deliberately *not* something a team leader can do: it's the
 * organiser's or an eventsAdmin's call, so the role can't quietly widen itself.
 * The whole list is replaced in one audited act, mirroring changeOrganiser.
 */
export const setTeamLeaders = mutation({
  args: {
    eventId: v.id("events"),
    userIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const signedInId = await requireSignedIn(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const userId = event.createdBy === signedInId ? signedInId : await requireEventsAdmin(ctx);

    // De-duplicate, and drop the organiser: they already manage the event, so
    // listing them as their own team leader is noise on the page.
    const leaderIds = [...new Set(args.userIds)].filter((id) => id !== event.createdBy);

    for (const leaderId of leaderIds) {
      const leader = await ctx.db.get(leaderId);
      if (!leader) throw new Error("That member no longer exists");
      // Shared accounts (truck tablets, the DO phone) are devices, not people -
      // nobody would be accountable for what the "leader" did.
      if (!isMemberAccount(leader)) {
        throw new Error("Pick a member, not a shared account");
      }
    }

    const current = event.teamLeaderIds ?? [];
    const unchanged =
      current.length === leaderIds.length && current.every((id) => leaderIds.includes(id));
    if (unchanged) return null;

    await ctx.db.patch(args.eventId, {
      teamLeaderIds: leaderIds,
      updatedAt: Date.now(),
    });

    await recordHistory(ctx, {
      eventId: args.eventId,
      userId,
      changeType: "team_leaders_change",
      field: "teamLeaders",
      oldValue: current,
      newValue: leaderIds,
    });

    return null;
  },
});

/**
 * Hand an event to a different organiser.
 *
 * The current organiser can always do this, even if their rank or roles have
 * since dropped below the eventsAdmin bar - someone who is standing down needs
 * to be able to pass their events on. Anyone with eventsAdmin can also
 * reassign, which covers the organiser who has left the brigade entirely.
 *
 * Kept separate from updateEvent so handing an event over is its own audited
 * act rather than a field buried in a form save.
 */
export const changeOrganiser = mutation({
  args: {
    eventId: v.id("events"),
    organiserId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const signedInId = await requireSignedIn(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const userId =
      event.createdBy === signedInId ? signedInId : await requireEventsAdmin(ctx);

    if (event.createdBy === args.organiserId) return null;

    const newOrganiser = await ctx.db.get(args.organiserId);
    if (!newOrganiser) throw new Error("That member no longer exists");
    // Shared accounts (truck tablets, the DO phone) are devices, not people;
    // an event handed to one would have nobody accountable for it.
    if (!isMemberAccount(newOrganiser)) {
      throw new Error("Pick a member, not a shared account");
    }

    await ctx.db.patch(args.eventId, {
      createdBy: args.organiserId,
      updatedAt: Date.now(),
    });

    await recordHistory(ctx, {
      eventId: args.eventId,
      userId,
      changeType: "organiser_change",
      field: "organiser",
      oldValue: event.createdBy,
      newValue: args.organiserId,
    });

    return null;
  },
});

/**
 * Cancel an event. Stays visible with a badge (no hard delete - preserves the
 * audit trail). Does not auto-notify; the organiser uses the Notify action.
 */
export const cancelEvent = mutation({
  args: {
    eventId: v.id("events"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, event } = await requireEventManager(ctx, args.eventId);
    if (event.status === "cancelled") {
      throw new Error("This event is already cancelled");
    }

    const now = Date.now();
    await ctx.db.patch(args.eventId, {
      status: "cancelled",
      cancelledBy: userId,
      cancelledAt: now,
      cancellationReason: args.reason,
      updatedAt: now,
    });

    await recordHistory(ctx, {
      eventId: args.eventId,
      userId,
      changeType: "event_cancelled",
      field: "status",
      oldValue: "active",
      newValue: "cancelled",
      notes: args.reason,
    });

    return null;
  },
});

/**
 * Restore a cancelled event back to active. Powers the cancel→undo toast.
 */
export const restoreEvent = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, event } = await requireEventManager(ctx, args.eventId);
    if (event.status !== "cancelled") {
      throw new Error("Only cancelled events can be restored");
    }

    await ctx.db.patch(args.eventId, {
      status: "active",
      cancelledBy: undefined,
      cancelledAt: undefined,
      cancellationReason: undefined,
      updatedAt: Date.now(),
    });

    await recordHistory(ctx, {
      eventId: args.eventId,
      userId,
      changeType: "event_restored",
      field: "status",
      oldValue: "cancelled",
      newValue: "active",
    });

    return null;
  },
});

/**
 * Permanently delete a cancelled event and everything attached to it. Must be
 * cancelled first (the soft-delete stays the default; this is the explicit
 * "remove entirely" escape hatch). Cascades rsvps, slots, slot interest,
 * allocations, and history.
 */
export const deleteEvent = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventsAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (event.status !== "cancelled") {
      throw new Error("Cancel the event before deleting it");
    }

    // Cascade-delete every child collection, all keyed by the by_event index
    const rsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const slotResponses = await ctx.db
      .query("eventSlotResponses")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const allocations = await ctx.db
      .query("eventSlotAllocations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const slots = await ctx.db
      .query("eventSlots")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const history = await ctx.db
      .query("eventHistory")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    for (const row of [...rsvps, ...slotResponses, ...allocations, ...slots, ...history]) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(args.eventId);
    return null;
  },
});

/**
 * Set or change the caller's RSVP for an event. Any signed-in member.
 * Upserts via by_event_user so each user has at most one RSVP per event.
 */
export const setRsvp = mutation({
  args: {
    eventId: v.id("events"),
    status: rsvpStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireSignedIn(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
    if (event.status !== "active") {
      throw new Error("This event has been cancelled");
    }
    if ((event.endDate ?? event.startDate) < aestTodayStr()) {
      throw new Error("This event has already happened");
    }
    // Shift events don't take yes/maybe RSVPs - picking a slot is the response
    // (declineSlotEvent handles "can't make it").
    if (event.hasShifts && args.status !== "notAttending") {
      throw new Error("This event uses shifts - pick a shift on the event page instead");
    }
    // Closed responses stop members opting *in*; declining always stays open so
    // anyone the organiser rostered can still say they can't make it.
    if (!responsesAreOpen(event) && args.status !== "notAttending") {
      throw new Error("The organiser has set who's going to this event");
    }

    const existing = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event_user", (q) => q.eq("eventId", args.eventId).eq("userId", userId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("eventRsvps", {
        eventId: args.eventId,
        userId,
        status: args.status,
        createdAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

// Guard shared by the slot-response mutations: event must be active and not past.
async function requireOpenEvent(ctx: MutationCtx, eventId: Id<"events">): Promise<Doc<"events">> {
  const event = await ctx.db.get(eventId);
  if (!event) {
    throw new Error("Event not found");
  }
  if (event.status !== "active") {
    throw new Error("This event has been cancelled");
  }
  if ((event.endDate ?? event.startDate) < aestTodayStr()) {
    throw new Error("This event has already happened");
  }
  return event;
}

/**
 * Toggle the caller's interest in a single slot. Picking a slot is the RSVP for
 * a slot event, so joining a slot also clears any "can't make it". Returns the
 * new membership state (true = now in the slot).
 */
export const toggleSlotResponse = mutation({
  args: { slotId: v.id("eventSlots") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireSignedIn(ctx);

    const slot = await ctx.db.get(args.slotId);
    if (!slot) {
      throw new Error("Shift not found");
    }
    const event = await requireOpenEvent(ctx, slot.eventId);
    if (!responsesAreOpen(event)) {
      throw new Error("The organiser has set who's on each shift for this event");
    }

    const existing = await ctx.db
      .query("eventSlotResponses")
      .withIndex("by_slot_user", (q) => q.eq("slotId", args.slotId).eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }

    await ctx.db.insert("eventSlotResponses", {
      eventId: slot.eventId,
      slotId: args.slotId,
      userId,
      createdAt: Date.now(),
    });

    // Joining a slot clears a prior "can't make it"
    const rsvp = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event_user", (q) => q.eq("eventId", slot.eventId).eq("userId", userId))
      .first();
    if (rsvp && rsvp.status === "notAttending") {
      await ctx.db.delete(rsvp._id);
    }

    return true;
  },
});

/**
 * Toggle "can't make it" for a slot event. Declining clears all the caller's
 * slot picks; toggling it off returns them to "no response". Returns the new
 * declined state.
 */
export const declineSlotEvent = mutation({
  args: { eventId: v.id("events") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireSignedIn(ctx);
    await requireOpenEvent(ctx, args.eventId);

    const existing = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event_user", (q) => q.eq("eventId", args.eventId).eq("userId", userId))
      .first();

    // Already declined → un-decline (back to no response)
    if (existing && existing.status === "notAttending") {
      await ctx.db.delete(existing._id);
      return false;
    }

    // Declining clears any slot picks
    const myResponses = await ctx.db
      .query("eventSlotResponses")
      .withIndex("by_event_user", (q) => q.eq("eventId", args.eventId).eq("userId", userId))
      .collect();
    for (const response of myResponses) {
      await ctx.db.delete(response._id);
    }

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { status: "notAttending", updatedAt: now });
    } else {
      await ctx.db.insert("eventRsvps", {
        eventId: args.eventId,
        userId,
        status: "notAttending",
        createdAt: now,
        updatedAt: now,
      });
    }

    return true;
  },
});

/**
 * Place or remove a member on a slot (the official roster), for whoever is
 * running the event. Allocation is independent of interest - anyone can be
 * placed. Returns the new state.
 */
export const toggleSlotAllocation = mutation({
  args: {
    slotId: v.id("eventSlots"),
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    if (!slot) {
      throw new Error("Shift not found");
    }
    const { userId: adminId } = await requireEventManager(ctx, slot.eventId);

    const existing = await ctx.db
      .query("eventSlotAllocations")
      .withIndex("by_slot_user", (q) => q.eq("slotId", args.slotId).eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }

    await ctx.db.insert("eventSlotAllocations", {
      eventId: slot.eventId,
      slotId: args.slotId,
      userId: args.userId,
      assignedBy: adminId,
      createdAt: Date.now(),
    });
    return true;
  },
});

/**
 * Place or remove a member on the event itself, for events with no
 * shifts to place them into. Same roster as toggleSlotAllocation, one level up.
 * Returns the new state.
 */
export const toggleEventAllocation = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { userId: adminId } = await requireEventManager(ctx, args.eventId);

    const existing = (
      await ctx.db
        .query("eventSlotAllocations")
        .withIndex("by_event_user", (q) =>
          q.eq("eventId", args.eventId).eq("userId", args.userId)
        )
        .collect()
    ).find((allocation) => allocation.slotId === undefined);

    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }

    await ctx.db.insert("eventSlotAllocations", {
      eventId: args.eventId,
      slotId: undefined,
      userId: args.userId,
      assignedBy: adminId,
      createdAt: Date.now(),
    });
    return true;
  },
});

/**
 * Open or close member responses.
 *
 * Deliberately non-destructive in both directions - it patches one field and
 * never touches an rsvp, a shift pick or a placement. Closing an event that
 * already collected interest doesn't discard it; it just stops counting until
 * the organiser opens things back up, so this is safe to flip as often as the
 * plan changes.
 *
 * `carryOverUserIds` is the one write it does make: when closing, the organiser
 * can seed the roster from the people who had already said yes, rather than
 * re-picking them by hand. Anyone already rostered is left alone.
 */
export const setMemberResponses = mutation({
  args: {
    eventId: v.id("events"),
    mode: v.union(v.literal("open"), v.literal("closed")),
    carryOverUserIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId: adminId, event } = await requireEventManager(ctx, args.eventId);

    const current = event.memberResponses ?? "open";

    if (args.mode === "closed" && args.carryOverUserIds && args.carryOverUserIds.length > 0) {
      const existing = await ctx.db
        .query("eventSlotAllocations")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect();
      const alreadyRostered = new Set(existing.map((allocation) => allocation.userId));

      const now = Date.now();
      for (const userId of args.carryOverUserIds) {
        if (alreadyRostered.has(userId)) continue;
        alreadyRostered.add(userId);
        await ctx.db.insert("eventSlotAllocations", {
          eventId: args.eventId,
          slotId: undefined,
          userId,
          assignedBy: adminId,
          createdAt: now,
        });
      }
    }

    if (current === args.mode) {
      return null;
    }

    await ctx.db.patch(args.eventId, {
      memberResponses: args.mode,
      updatedAt: Date.now(),
    });

    await recordHistory(ctx, {
      eventId: args.eventId,
      userId: adminId,
      changeType: "field_change",
      field: "memberResponses",
      oldValue: current,
      newValue: args.mode,
    });

    return null;
  },
});

/**
 * Slots for an event (member-facing), ordered. Each carries the official
 * **allocated** roster and the **interested** members (both member-visible -
 * before allocation starts, interest per shift IS the turnout picture), plus
 * whether the caller is interested in / allocated to it. Empty for non-slot
 * events.
 */
export const getEventSlots = query({
  args: { eventId: v.id("events") },
  returns: v.array(
    v.object({
      _id: v.id("eventSlots"),
      label: v.string(),
      startTime: v.optional(v.string()),
      endTime: v.optional(v.string()),
      date: v.optional(v.string()),
      targetCount: v.optional(v.number()),
      order: v.number(),
      allocatedCount: v.number(),
      allocated: v.array(
        v.object({
          _id: v.id("users"),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
          name: v.optional(v.string()),
          // Rostered but has marked "can't make it" - a conflict to surface
          declined: v.boolean(),
        })
      ),
      interested: v.array(userNameValidator),
      mineInterested: v.boolean(),
      mineAllocated: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const slots = await ctx.db
      .query("eventSlots")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    slots.sort((a, b) => a.order - b.order);

    // Event-wide "can't make it" set, used to flag rostered decliners
    const eventRsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const declinedIds = new Set(
      eventRsvps.filter((r) => r.status === "notAttending").map((r) => r.userId)
    );

    return await Promise.all(
      slots.map(async (slot) => {
        const [allocations, interestRows] = await Promise.all([
          ctx.db
            .query("eventSlotAllocations")
            .withIndex("by_slot", (q) => q.eq("slotId", slot._id))
            .collect(),
          ctx.db
            .query("eventSlotResponses")
            .withIndex("by_slot", (q) => q.eq("slotId", slot._id))
            .collect(),
        ]);
        const allocated = (
          await Promise.all(allocations.map((a) => ctx.db.get(a.userId)))
        )
          .filter((user): user is Doc<"users"> => user !== null)
          .map((user) => ({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            declined: declinedIds.has(user._id),
          }));

        const interested = (
          await Promise.all(interestRows.map((r) => ctx.db.get(r.userId)))
        )
          .filter((user): user is Doc<"users"> => user !== null)
          .map((user) => ({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
          }));

        const myInterest = interestRows.find((r) => r.userId === userId) ?? null;

        return {
          _id: slot._id,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          date: slot.date,
          targetCount: slot.targetCount,
          order: slot.order,
          allocatedCount: allocations.length,
          allocated,
          interested,
          mineInterested: myInterest !== null,
          mineAllocated: allocations.some((a) => a.userId === userId),
        };
      })
    );
  },
});

/**
 * Admin roster view for the allocation UI: all members, who is allocated to the
 * event itself, and per slot who is interested and who is allocated. A shiftless
 * event simply has no slots and is rostered through `eventAllocatedIds`.
 * Returns null for non-admins.
 */
export const getEventRoster = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.object({
      members: v.array(userNameValidator),
      // Members who marked "can't make it" (event-wide) - flag them in the
      // allocation UI, especially when they're still on the roster
      declinedIds: v.array(v.id("users")),
      // Placed on the event rather than a shift (the whole roster for a
      // shiftless event)
      eventAllocatedIds: v.array(v.id("users")),
      slots: v.array(
        v.object({
          _id: v.id("eventSlots"),
          label: v.string(),
          startTime: v.optional(v.string()),
          endTime: v.optional(v.string()),
          date: v.optional(v.string()),
          targetCount: v.optional(v.number()),
          order: v.number(),
          allocatedIds: v.array(v.id("users")),
          interestedIds: v.array(v.id("users")),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || (await eventManagerId(ctx, event)) === null) {
      return null;
    }

    const users = (await ctx.db.query("users").collect()).filter(isMemberAccount);
    const members = users
      .map((user) => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
      }))
      .sort((a, b) =>
        `${a.firstName ?? a.name ?? ""}`.localeCompare(`${b.firstName ?? b.name ?? ""}`)
      );

    const slots = await ctx.db
      .query("eventSlots")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    slots.sort((a, b) => a.order - b.order);

    const slotsWithRoster = await Promise.all(
      slots.map(async (slot) => {
        const [allocations, interest] = await Promise.all([
          ctx.db
            .query("eventSlotAllocations")
            .withIndex("by_slot", (q) => q.eq("slotId", slot._id))
            .collect(),
          ctx.db
            .query("eventSlotResponses")
            .withIndex("by_slot", (q) => q.eq("slotId", slot._id))
            .collect(),
        ]);
        return {
          _id: slot._id,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          date: slot.date,
          targetCount: slot.targetCount,
          order: slot.order,
          allocatedIds: allocations.map((a) => a.userId),
          interestedIds: interest.map((r) => r.userId),
        };
      })
    );

    const rsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const declinedIds = rsvps
      .filter((r) => r.status === "notAttending")
      .map((r) => r.userId);

    const eventAllocatedIds = (
      await ctx.db
        .query("eventSlotAllocations")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .collect()
    )
      .filter((allocation) => allocation.slotId === undefined)
      .map((allocation) => allocation.userId);

    return { members, declinedIds, eventAllocatedIds, slots: slotsWithRoster };
  },
});

// ─── Internal functions for the reminder pipeline ───────────────────────────

/**
 * Record a notification_sent entry in the event's audit trail.
 */
export const recordNotificationSent = internalMutation({
  args: {
    eventId: v.id("events"),
    userId: v.id("users"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await recordHistory(ctx, {
      eventId: args.eventId,
      userId: args.userId,
      changeType: "notification_sent",
      field: "notification",
      oldValue: null,
      newValue: "sent",
      notes: args.notes,
    });
    return null;
  },
});
