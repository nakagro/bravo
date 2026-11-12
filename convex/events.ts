import { query, mutation, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { isMemberAccount } from "./lib/accountType";
import { crewSummaryFor, deleteEventCrews, reconcileCrewAppliances } from "./lib/eventCrews";
import { brigadeDateStr } from "./lib/dates";
import { moduleSettingAllows } from "./modules";
import { applyChangeNotice, buildChangePreview, changeNoticeRow } from "./lib/eventChangeNotice";
import { logNoticeSend } from "./lib/notificationDelivery";

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
  allowsGuests: v.optional(v.boolean()),
  maxGuestsPerMember: v.optional(v.number()),
  collectsDietary: v.optional(v.boolean()),
  isAllDay: v.boolean(),
  cancelledBy: v.optional(v.id("users")),
  cancelledAt: v.optional(v.number()),
  cancellationReason: v.optional(v.string()),
  createdBy: v.id("users"),
  teamLeaderIds: v.optional(v.array(v.id("users"))),
  attendanceConfirmedAt: v.optional(v.number()),
  attendanceConfirmedBy: v.optional(v.id("users")),
  attendanceNotNeeded: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
  counts: v.object({
    attending: v.number(),
    notAttending: v.number(),
    maybe: v.number(),
    // Extra heads the attending members are bringing (events.allowsGuests).
    // Deliberately *not* folded into `attending`: that number is a count of
    // members, and the breakdown bar, the roster and the attendance sheet all
    // key off member identity. Total headcount is attending + guests, composed
    // where it is displayed.
    guests: v.number(),
  }),
  myRsvp: v.union(rsvpStatusValidator, v.null()),
  // The caller's own answers to the guest / dietary questions, so the RSVP
  // control can show what they last said without a second query.
  myGuestCount: v.number(),
  myDietaryNotes: v.union(v.string(), v.null()),
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
  // How many people actually turned up, once someone has confirmed it. Null
  // means unconfirmed - a different thing from "nobody came", and the state the
  // past-events list nudges about.
  attendedCount: v.union(v.number(), v.null()),
  // Appliances crewed for the event (eventCrews), in the order added, with how
  // many of each one's seats are filled.
  crews: v.array(
    v.object({ applianceName: v.string(), filled: v.number(), total: v.number() })
  ),
  // The caller's own seat, if they're crewing an appliance - independent of
  // whether they're on the roster.
  myCrewSeat: v.union(v.null(), v.object({ applianceName: v.string(), role: v.string() })),
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
export async function attendanceFor(
  ctx: QueryCtx,
  event: Doc<"events">
): Promise<{
  going: Set<Id<"users">>;
  // The official roster alone - a subset of `going`, and the difference between
  // "I've offered" and "I've been given a shift"
  rostered: Set<Id<"users">>;
  declined: Set<Id<"users">>;
  rsvps: Doc<"eventRsvps">[];
  // Extra heads the people in `going` are bringing. Follows the same rules the
  // head count follows, so a decline or a closed event drops a member's guests
  // along with the member.
  guestTotal: number;
  guestsByUser: Map<Id<"users">, number>;
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

  const guestsByUser = new Map<Id<"users">, number>();
  let guestTotal = 0;
  if (event.allowsGuests) {
    for (const rsvp of rsvps) {
      const guests = rsvp.guestCount ?? 0;
      if (guests <= 0 || !going.has(rsvp.userId)) continue;
      guestsByUser.set(rsvp.userId, guests);
      guestTotal += guests;
    }
  }

  return { going, rostered, declined, rsvps, guestTotal, guestsByUser };
}

/**
 * Who was *meant* to turn up - the yardstick confirmed attendance is measured
 * against. Narrower than `going` on a shift event: interest in a shift is an
 * offer, not a commitment, so once the organiser has rostered anyone only the
 * roster is expected. Calling an offer that was never taken up a no-show would
 * put something false on the member's record. A shift event nobody was
 * rostered on has nothing better than interest, so it falls back to `going`.
 */
async function expectedAttendeesFor(
  ctx: QueryCtx,
  event: Doc<"events">
): Promise<{ expected: Set<Id<"users">>; going: Set<Id<"users">> }> {
  const { going, rostered } = await attendanceFor(ctx, event);
  if (!event.hasShifts || rostered.size === 0) return { expected: going, going };
  // Through `going` so a rostered decliner still drops out
  return { expected: new Set([...rostered].filter((id) => going.has(id))), going };
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
  const { going, rostered, declined, rsvps, guestTotal } = await attendanceFor(ctx, event);

  const counts = {
    attending: going.size,
    notAttending: declined.size,
    maybe: 0,
    guests: guestTotal,
  };
  let myRsvp: "attending" | "notAttending" | "maybe" | null = null;
  const myRsvpRow = rsvps.find((rsvp) => rsvp.userId === userId) ?? null;

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

  // Only read the attendance rows once somebody has confirmed - an unconfirmed
  // event has none, and this runs per row in the events lists.
  const attendedCount = event.attendanceConfirmedAt
    ? (
        await ctx.db
          .query("eventAttendance")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()
      ).length
    : null;

  let eventTypeInfo: { _id: Id<"eventTypes">; name: string; color: string } | null = null;
  if (event.eventTypeId) {
    const type = await ctx.db.get(event.eventTypeId);
    if (type) {
      eventTypeInfo = { _id: type._id, name: type.name, color: type.color };
    }
  }

  const crewSummary = await crewSummaryFor(ctx, event._id, userId);

  return {
    ...event,
    counts,
    myRsvp,
    crews: crewSummary.crews,
    myCrewSeat: crewSummary.mySeat,
    // Only meaningful while the event is asking; a stale count on a shift or
    // closed event would show the member a number nobody is counting.
    myGuestCount:
      event.allowsGuests && myRsvp === "attending" ? (myRsvpRow?.guestCount ?? 0) : 0,
    myDietaryNotes: event.collectsDietary ? (myRsvpRow?.dietaryNotes ?? null) : null,
    attendedCount,
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
      // Per-member guest counts, so the attending list can render "Jane Smith
      // +2" without a second query. Only members bringing someone appear.
      guestCounts: v.array(v.object({ userId: v.id("users"), count: v.number() })),
      guestTotal: v.number(),
      // When each member answered and when they last touched it, manager-only.
      // Reads straight off the rsvp row's createdAt/updatedAt, so it is
      // complete for every event that already existed before this shipped.
      responseTimes: v.union(
        v.array(
          v.object({
            userId: v.id("users"),
            respondedAt: v.number(),
            changedAt: v.number(),
          })
        ),
        v.null()
      ),
      // Dietary requirements, manager-only (null for everyone else). Health
      // information: the attending list is brigade-wide, this isn't.
      dietary: v.union(
        v.array(v.object({ member: userNameValidator, notes: v.string() })),
        v.null()
      ),
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

    const { going: attendingIds, rsvps, guestsByUser, guestTotal } = await attendanceFor(
      ctx,
      event
    );

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
    const attendingIdSet = new Set(attending.map((member) => member._id));
    const guestCounts = [...guestsByUser.entries()]
      // A guest count for someone who isn't in the visible attending list (a
      // shared account, a deleted user) has nobody to hang off.
      .filter(([userId]) => attendingIdSet.has(userId))
      .map(([userId, count]) => ({ userId, count }));

    if ((await eventManagerId(ctx, event)) === null) {
      return {
        attending,
        rosteredNoShift,
        guestCounts,
        guestTotal,
        responseTimes: null,
        dietary: null,
        breakdown: null,
      };
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

    const usersById = new Map(users.map((user) => [user._id, user]));
    const dietary = event.collectsDietary
      ? rsvps
          .filter(
            (rsvp) =>
              attendingIds.has(rsvp.userId) &&
              !!rsvp.dietaryNotes?.trim() &&
              usersById.has(rsvp.userId)
          )
          .map((rsvp) => ({
            member: nameOf(usersById.get(rsvp.userId)!),
            notes: rsvp.dietaryNotes!.trim(),
          }))
      : [];

    const responseTimes = rsvps.map((rsvp) => ({
      userId: rsvp.userId,
      respondedAt: rsvp.createdAt,
      changedAt: rsvp.updatedAt,
    }));

    return {
      attending,
      rosteredNoShift,
      guestCounts,
      guestTotal,
      responseTimes,
      dietary,
      breakdown: { maybe, notAttending, noResponse, totalMembers: users.length },
    };
  },
});

/**
 * Confirmed attendance - who actually turned up.
 *
 * Separate from both the RSVPs and the roster on purpose: what members said
 * beforehand and who an organiser rostered are predictions, and the brigade has
 * to report the real thing (community-engagement events go into a public-facing
 * system afterwards). So this is recorded after the fact and is allowed to
 * disagree with everything above it.
 *
 * The list itself is visible to every signed-in member, like the attending list.
 * The *deviation* - who said yes and didn't show - is only for whoever is
 * running the event, same rule as the response breakdown.
 */
export const getConfirmedAttendance = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.object({
      confirmedAt: v.union(v.number(), v.null()),
      confirmedBy: v.union(userNameValidator, v.null()),
      // Closed off as needing no attendance record (attendees is then empty)
      notNeeded: v.boolean(),
      attendees: v.array(userNameValidator),
      // Whether the caller may record/amend it (eventsAdmin, organiser, leader)
      canConfirm: v.boolean(),
      deviation: v.union(
        v.object({
          // Expected (see expectedAttendeesFor) but not marked present
          noShows: v.array(userNameValidator),
          // Turned up without being expected
          unexpected: v.array(userNameValidator),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const rows = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const nameOf = (user: Doc<"users">) => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
    });

    const attendeeDocs = (await Promise.all(rows.map((row) => ctx.db.get(row.userId)))).filter(
      (user): user is Doc<"users"> => user !== null
    );
    const attendees = attendeeDocs.map(nameOf);

    const confirmedByUser = event.attendanceConfirmedBy
      ? await ctx.db.get(event.attendanceConfirmedBy)
      : null;

    const canConfirm = (await eventManagerId(ctx, event)) !== null;

    let deviation: {
      noShows: ReturnType<typeof nameOf>[];
      unexpected: ReturnType<typeof nameOf>[];
    } | null = null;

    if (canConfirm && event.attendanceConfirmedAt && !event.attendanceNotNeeded) {
      const { expected, going } = await expectedAttendeesFor(ctx, event);
      const attendedIds = new Set(attendeeDocs.map((user) => user._id));

      const noShowDocs = (
        await Promise.all(
          [...expected].filter((id) => !attendedIds.has(id)).map((id) => ctx.db.get(id))
        )
      ).filter((user): user is Doc<"users"> => user !== null && isMemberAccount(user));

      deviation = {
        noShows: noShowDocs.map(nameOf),
        // Measured against `going`, not `expected`: someone who offered for a
        // shift and came did respond, even if they weren't rostered
        unexpected: attendeeDocs.filter((user) => !going.has(user._id)).map(nameOf),
      };
    }

    return {
      confirmedAt: event.attendanceConfirmedAt ?? null,
      confirmedBy: confirmedByUser ? nameOf(confirmedByUser) : null,
      notNeeded: event.attendanceNotNeeded === true,
      attendees,
      canConfirm,
      deviation,
    };
  },
});

/**
 * Everything the confirm-attendance sheet needs: every member, who was
 * *expected* (expectedAttendeesFor - the prefill), and who is currently
 * confirmed. Returns null for anyone who may not run this event.
 */
/**
 * The story of how an event's responses got to where they are: every change a
 * member made to their own answer, newest first.
 *
 * Manager-only. The timestamps on the rsvp row say *when* somebody last touched
 * their answer; this says *what they did* - the yes that became a no the night
 * before, the shift picked up and quietly dropped. Shift picks have no other
 * record at all, since dropping one deletes the row.
 *
 * Only covers changes made from the day this shipped: the rows it reads are
 * written by the response mutations, not reconstructed from anything older.
 */
export const getResponseActivity = query({
  args: { eventId: v.id("events"), limit: v.optional(v.number()) },
  returns: v.union(
    v.array(
      v.object({
        _id: v.id("eventHistory"),
        timestamp: v.number(),
        member: v.union(userNameValidator, v.null()),
        field: v.string(),
        oldValue: v.any(),
        newValue: v.any(),
      })
    ),
    v.null()
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || (await eventManagerId(ctx, event)) === null) {
      return null;
    }

    const rows = await ctx.db
      .query("eventHistory")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .order("desc")
      .collect();

    const responseRows = rows
      .filter((row) => row.changeType === "response_change")
      .slice(0, Math.min(args.limit ?? 50, 200));

    const members = await Promise.all(responseRows.map((row) => ctx.db.get(row.userId)));

    return responseRows.map((row, index) => {
      const member = members[index];
      return {
        _id: row._id,
        timestamp: row.timestamp,
        // A member deleted since they answered still has a change worth showing
        member: member
          ? {
              _id: member._id,
              firstName: member.firstName,
              lastName: member.lastName,
              name: member.name,
            }
          : null,
        field: row.field,
        oldValue: row.oldValue ?? null,
        newValue: row.newValue ?? null,
      };
    });
  },
});

export const getAttendanceSheet = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.object({
      members: v.array(userNameValidator),
      expectedIds: v.array(v.id("users")),
      confirmedIds: v.array(v.id("users")),
      confirmedAt: v.union(v.number(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || (await eventManagerId(ctx, event)) === null) {
      return null;
    }

    const members = (await ctx.db.query("users").collect())
      .filter(isMemberAccount)
      .map((user) => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
      }))
      .sort((a, b) =>
        `${a.firstName ?? a.name ?? ""}`.localeCompare(`${b.firstName ?? b.name ?? ""}`)
      );
    const memberIds = new Set(members.map((member) => member._id));

    const { expected } = await expectedAttendeesFor(ctx, event);
    const rows = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return {
      members,
      expectedIds: [...expected].filter((id) => memberIds.has(id)),
      confirmedIds: rows.map((row) => row.userId).filter((id) => memberIds.has(id)),
      confirmedAt: event.attendanceConfirmedAt ?? null,
    };
  },
});

/**
 * Record who actually turned up. The submitted list replaces the stored one
 * wholesale, so amending is just confirming again with a corrected list - there
 * is no separate edit path to get out of step.
 *
 * Nothing here touches an RSVP, a shift pick or a placement: the prediction
 * stays on the record next to the outcome, which is exactly what makes the
 * deviation auditable afterwards.
 */
export const setEventAttendance = mutation({
  args: {
    eventId: v.id("events"),
    userIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId: adminId, event } = await requireEventManager(ctx, args.eventId);

    // Shared accounts (truck tablets, the DO phone) aren't people and must
    // never land in an attendance record that gets reported on.
    const requested = new Set<Id<"users">>();
    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      if (user && isMemberAccount(user)) requested.add(userId);
    }

    const existing = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const existingIds = new Set(existing.map((row) => row.userId));

    const now = Date.now();
    for (const row of existing) {
      if (!requested.has(row.userId)) await ctx.db.delete(row._id);
    }
    for (const userId of requested) {
      if (existingIds.has(userId)) continue;
      await ctx.db.insert("eventAttendance", {
        eventId: args.eventId,
        userId,
        recordedBy: adminId,
        recordedAt: now,
      });
    }

    await ctx.db.patch(args.eventId, {
      attendanceConfirmedAt: now,
      attendanceConfirmedBy: adminId,
      attendanceNotNeeded: undefined,
      updatedAt: now,
    });

    const wasConfirmed = event.attendanceConfirmedAt !== undefined;
    await recordHistory(ctx, {
      eventId: args.eventId,
      userId: adminId,
      changeType: wasConfirmed ? "attendance_amended" : "attendance_confirmed",
      field: "attendance",
      oldValue: wasConfirmed ? existing.length : null,
      newValue: requested.size,
      notes: `${requested.size} ${requested.size === 1 ? "member" : "members"} attended`,
    });

    return null;
  },
});

/**
 * Flag an event as needing no attendance record (or lift the flag). Flagged
 * events never show as unconfirmed. Turning it on drops any recorded list -
 * the two states don't coexist; confirming attendance later lifts the flag.
 */
async function applyAttendanceNotNeeded(
  ctx: MutationCtx,
  event: Doc<"events">,
  actorId: Id<"users">,
  notNeeded: boolean
) {
  if ((event.attendanceNotNeeded === true) === notNeeded) return;
  const now = Date.now();
  if (!notNeeded) {
    await ctx.db.patch(event._id, { attendanceNotNeeded: undefined, updatedAt: now });
  } else {
    const existing = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    await ctx.db.patch(event._id, {
      attendanceConfirmedAt: undefined,
      attendanceConfirmedBy: undefined,
      attendanceNotNeeded: true,
      updatedAt: now,
    });
  }
  await recordHistory(ctx, {
    eventId: event._id,
    userId: actorId,
    changeType: notNeeded ? "attendance_not_needed" : "attendance_needed",
    field: "attendance",
    oldValue: null,
    newValue: null,
    notes: notNeeded ? "No attendance record needed" : "Attendance record needed again",
  });
}

/**
 * Set whether an event needs an attendance record - from the event page after
 * the fact; the event form sends the same flag through create/updateEvent.
 */
export const setAttendanceNotNeeded = mutation({
  args: { eventId: v.id("events"), notNeeded: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, event } = await requireEventManager(ctx, args.eventId);
    await applyAttendanceNotNeeded(ctx, event, userId, args.notNeeded);
    return null;
  },
});

/**
 * Undo a confirmation - drops the recorded list and puts the event back to
 * "not confirmed yet". For a sheet submitted against the wrong event; correcting
 * a list is done by confirming again, not by clearing first.
 */
export const clearEventAttendance = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId: adminId, event } = await requireEventManager(ctx, args.eventId);

    if (event.attendanceConfirmedAt === undefined) {
      return null;
    }

    const existing = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);

    await ctx.db.patch(args.eventId, {
      attendanceConfirmedAt: undefined,
      attendanceConfirmedBy: undefined,
      attendanceNotNeeded: undefined,
      updatedAt: Date.now(),
    });

    await recordHistory(ctx, {
      eventId: args.eventId,
      userId: adminId,
      changeType: "attendance_cleared",
      field: "attendance",
      oldValue: existing.length,
      newValue: null,
    });

    return null;
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
    allowsGuests: v.optional(v.boolean()),
    maxGuestsPerMember: v.optional(v.number()),
    collectsDietary: v.optional(v.boolean()),
    attendanceNotNeeded: v.optional(v.boolean()),
    slots: v.optional(v.array(slotInputValidator)),
    // Appliances that need crewing; each becomes an empty eventCrews row
    crewAppliances: v.optional(v.array(v.string())),
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
      // Guests belong to social, shiftless events - a shift roster is
      // operational and a slot pick has no party attached to it.
      allowsGuests: args.hasShifts ? undefined : args.allowsGuests,
      maxGuestsPerMember: args.hasShifts ? undefined : args.maxGuestsPerMember,
      collectsDietary: args.hasShifts ? undefined : args.collectsDietary,
      attendanceNotNeeded: args.attendanceNotNeeded || undefined,
      isAllDay: args.isAllDay,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    if (args.hasShifts && args.slots && args.slots.length > 0) {
      await reconcileSlots(ctx, eventId, args.slots);
    }

    if (args.crewAppliances && args.crewAppliances.length > 0) {
      await reconcileCrewAppliances(ctx, eventId, args.crewAppliances, userId);
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
/**
 * Never notifies anyone. When the date, time or location changes, the event
 * form offers a separate "Changed: …" send afterwards (sendEventChangeNotice).
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
    allowsGuests: v.optional(v.boolean()),
    // "" clears the cap back to unlimited (the bookings convention the loop
    // below already follows for optional fields).
    maxGuestsPerMember: v.optional(v.union(v.number(), v.literal(""))),
    collectsDietary: v.optional(v.boolean()),
    attendanceNotNeeded: v.optional(v.boolean()),
    slots: v.optional(v.array(slotInputValidator)),
    // The full list of appliances needing crew. Sent = reconcile (an empty
    // list removes them all); absent = leave the crews alone.
    crewAppliances: v.optional(v.array(v.string())),
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
      "allowsGuests",
      "maxGuestsPerMember",
      "collectsDietary",
      "isAllDay",
    ] as const;

    if (args.attendanceNotNeeded !== undefined) {
      await applyAttendanceNotNeeded(ctx, event, userId, args.attendanceNotNeeded);
    }

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

    if (args.maxGuestsPerMember !== undefined && typeof args.maxGuestsPerMember === "number") {
      if (
        !Number.isInteger(args.maxGuestsPerMember) ||
        args.maxGuestsPerMember < 1 ||
        args.maxGuestsPerMember > MAX_GUESTS_PER_MEMBER
      ) {
        throw new Error(`Guest limit must be a whole number from 1 to ${MAX_GUESTS_PER_MEMBER}`);
      }
    }

    // Turning shifts on retires the guest questions - the event stopped being
    // the kind that asks them. The stored answers are left alone, so turning
    // shifts back off restores the event exactly as it was.
    if ((args.hasShifts ?? event.hasShifts) && event.allowsGuests) {
      updateData.allowsGuests = undefined;
      updateData.collectsDietary = undefined;
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

    // Independent of column changes, like the slots: an appliance-only edit
    // must still apply.
    if (args.crewAppliances !== undefined) {
      await reconcileCrewAppliances(ctx, args.eventId, args.crewAppliances, userId);
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
 * audit trail). Tells nobody unless `notifyFingerprint` is passed: then the
 * cancellation notice goes to everyone involved in the same transaction, so
 * the event can't end up cancelled with the notice lost. A stale fingerprint
 * fails the whole call and the event stays active.
 */
export const cancelEvent = mutation({
  args: {
    eventId: v.id("events"),
    reason: v.optional(v.string()),
    notifyFingerprint: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, event } = await requireEventManager(ctx, args.eventId);
    if (event.status === "cancelled") {
      throw new Error("This event is already cancelled");
    }

    const preview = args.notifyFingerprint
      ? await buildChangePreview(ctx, event, userId, "cancelled", args.reason?.trim() ?? "", true)
      : null;
    if (args.notifyFingerprint && preview?.fingerprint !== args.notifyFingerprint) {
      throw new Error("Who's involved or the message changed, check it again");
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

    if (preview && preview.recipients.length > 0) {
      const cancelled = (await ctx.db.get(args.eventId))!;
      await applyChangeNotice(ctx, cancelled, userId, "cancelled", preview, args.reason?.trim());
    }

    return null;
  },
});

/**
 * Restore a cancelled event back to active (also the cancel→undo toast, which
 * only offers Undo when no notice went out). Tells nobody unless
 * `notifyFingerprint` is passed, and that's only offered when the cancellation
 * was announced: the "back on" notice then goes to the same members, in the
 * same transaction.
 */
export const restoreEvent = mutation({
  args: { eventId: v.id("events"), notifyFingerprint: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, event } = await requireEventManager(ctx, args.eventId);
    if (event.status !== "cancelled") {
      throw new Error("Only cancelled events can be restored");
    }

    const preview = args.notifyFingerprint
      ? await buildChangePreview(ctx, event, userId, "restored", "", true)
      : null;
    if (args.notifyFingerprint && preview?.fingerprint !== args.notifyFingerprint) {
      throw new Error("Who's involved changed, check it again");
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

    if (preview && preview.recipients.length > 0) {
      const restored = (await ctx.db.get(args.eventId))!;
      await applyChangeNotice(ctx, restored, userId, "restored", preview);
    }

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
    const attendance = await ctx.db
      .query("eventAttendance")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    await deleteEventCrews(ctx, args.eventId);

    // Assignment receipts double as Action Centre items, and the change notice
    // row's "View" would lead to a deleted event.
    const receipts = await ctx.db
      .query("assignmentReceipts")
      .withIndex("by_scope_user", (q) => q.eq("scopeKey", `event:${args.eventId}`))
      .collect();
    const sends = await ctx.db
      .query("notificationSends")
      .withIndex("by_scope_sentAt", (q) => q.eq("scopeKey", `event:${args.eventId}`))
      .collect();
    const changeNotice = await changeNoticeRow(ctx, args.eventId);
    if (changeNotice) await ctx.db.delete(changeNotice._id);

    for (const row of [
      ...rsvps,
      ...slotResponses,
      ...allocations,
      ...slots,
      ...history,
      ...attendance,
      ...receipts,
      ...sends,
    ]) {
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
// A ceiling that applies even when the organiser set no cap. Nobody brings 200
// people to a brigade dinner; a number that large is a stuck stepper or a typo,
// and it would quietly wreck the catering headcount.
const MAX_GUESTS_PER_MEMBER = 50;
const MAX_DIETARY_NOTES = 500;

export const setRsvp = mutation({
  args: {
    eventId: v.id("events"),
    status: rsvpStatusValidator,
    // Both absent = "leave what I said before alone", which is what the plain
    // Yes/Maybe/No buttons send.
    guestCount: v.optional(v.number()),
    dietaryNotes: v.optional(v.string()),
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
    if ((event.endDate ?? event.startDate) < brigadeDateStr()) {
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

    if (args.guestCount !== undefined) {
      if (!event.allowsGuests) {
        throw new Error("This event isn't taking guests");
      }
      if (!Number.isInteger(args.guestCount) || args.guestCount < 0) {
        throw new Error("Guest count must be a whole number");
      }
      const cap = Math.min(event.maxGuestsPerMember ?? MAX_GUESTS_PER_MEMBER, MAX_GUESTS_PER_MEMBER);
      if (args.guestCount > cap) {
        throw new Error(`You can bring at most ${cap} guest${cap === 1 ? "" : "s"} to this event`);
      }
    }
    if (args.dietaryNotes !== undefined) {
      if (!event.collectsDietary) {
        throw new Error("This event isn't collecting dietary requirements");
      }
      if (args.dietaryNotes.length > MAX_DIETARY_NOTES) {
        throw new Error(`Keep dietary requirements under ${MAX_DIETARY_NOTES} characters`);
      }
    }

    const existing = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event_user", (q) => q.eq("eventId", args.eventId).eq("userId", userId))
      .first();

    // A "no" or a "maybe" carries no party: clearing here means the organiser
    // never counts guests for someone who isn't coming, and a member who
    // changes their mind back re-enters the number rather than inheriting a
    // stale one.
    const attending = args.status === "attending";
    const guestCount = attending
      ? (args.guestCount ?? existing?.guestCount ?? undefined)
      : undefined;
    const dietaryNotes = attending
      ? (args.dietaryNotes ?? existing?.dietaryNotes ?? undefined)
      : undefined;
    const trimmedNotes = dietaryNotes?.trim() ? dietaryNotes.trim() : undefined;

    const now = Date.now();
    // Log before writing, while the previous answer is still readable. A member
    // pressing the same button again isn't a change and isn't logged - otherwise
    // the organiser's view fills with noise that says nothing happened.
    if (existing?.status !== args.status) {
      await logResponseChange(ctx, {
        eventId: args.eventId,
        userId,
        field: "rsvp",
        oldValue: existing?.status ?? null,
        newValue: args.status,
      });
    }
    const previousGuests = existing?.guestCount ?? 0;
    const nextGuests = guestCount ?? 0;
    if (event.allowsGuests && nextGuests !== previousGuests) {
      await logResponseChange(ctx, {
        eventId: args.eventId,
        userId,
        field: "guests",
        oldValue: previousGuests,
        newValue: nextGuests,
      });
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        guestCount: guestCount && guestCount > 0 ? guestCount : undefined,
        dietaryNotes: trimmedNotes,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("eventRsvps", {
        eventId: args.eventId,
        userId,
        status: args.status,
        guestCount: guestCount && guestCount > 0 ? guestCount : undefined,
        dietaryNotes: trimmedNotes,
        createdAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Log a member changing their own response, into the same eventHistory table the
 * organiser's edits go to.
 *
 * The rsvp row already carries createdAt/updatedAt, which answers "when did they
 * last touch this" for every event that already exists. What it can't answer is
 * *what they changed from* - and for a shift pick it can't answer anything at
 * all, because dropping a shift deletes the row. This log fills both gaps from
 * here on.
 *
 * `userId` is the member themselves, not an organiser: these rows are the
 * member's own acts.
 */
async function logResponseChange(
  ctx: MutationCtx,
  entry: {
    eventId: Id<"events">;
    userId: Id<"users">;
    // rsvp = yes/maybe/no, shift = a slot picked or dropped, guests = the +1 count
    field: "rsvp" | "shift" | "guests";
    oldValue: unknown;
    newValue: unknown;
  }
) {
  await recordHistory(ctx, { ...entry, changeType: "response_change" });
}

// Guard shared by the slot-response mutations: event must be active and not past.
async function requireOpenEvent(ctx: MutationCtx, eventId: Id<"events">): Promise<Doc<"events">> {
  const event = await ctx.db.get(eventId);
  if (!event) {
    throw new Error("Event not found");
  }
  if (event.status !== "active") {
    throw new Error("This event has been cancelled");
  }
  if ((event.endDate ?? event.startDate) < brigadeDateStr()) {
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
      await logResponseChange(ctx, {
        eventId: slot.eventId,
        userId,
        field: "shift",
        oldValue: slot.label,
        newValue: null,
      });
      await ctx.db.delete(existing._id);
      return false;
    }

    await logResponseChange(ctx, {
      eventId: slot.eventId,
      userId,
      field: "shift",
      oldValue: null,
      newValue: slot.label,
    });

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
      await logResponseChange(ctx, {
        eventId: slot.eventId,
        userId,
        field: "rsvp",
        oldValue: "notAttending",
        newValue: null,
      });
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
      await logResponseChange(ctx, {
        eventId: args.eventId,
        userId,
        field: "rsvp",
        oldValue: "notAttending",
        newValue: null,
      });
      await ctx.db.delete(existing._id);
      return false;
    }

    if (existing?.status !== "notAttending") {
      await logResponseChange(ctx, {
        eventId: args.eventId,
        userId,
        field: "rsvp",
        oldValue: existing?.status ?? null,
        newValue: "notAttending",
      });
    }

    // Declining clears any slot picks
    const myResponses = await ctx.db
      .query("eventSlotResponses")
      .withIndex("by_event_user", (q) => q.eq("eventId", args.eventId).eq("userId", userId))
      .collect();
    for (const response of myResponses) {
      // Each dropped pick is logged: the rows are about to be deleted, so this
      // is the only record that the member ever held those shifts.
      const slot = await ctx.db.get(response.slotId);
      await logResponseChange(ctx, {
        eventId: args.eventId,
        userId,
        field: "shift",
        oldValue: slot?.label ?? "a shift",
        newValue: null,
      });
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
// Saving does not notify anyone. Members are told only when the sender
// confirms a send from SendAssignmentsSheet (convex/assignmentNotices.ts).
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
    // The broadcast's title and note, for the event's running sheet of sends
    title: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await logNoticeSend(ctx, {
      scopeKey: `event:${args.eventId}`,
      kind: "broadcast",
      title: args.title ?? "Notify",
      message: args.message,
      recipientCount: 0, // everyone with a device; not counted
      recipients: [],
      sentBy: args.userId,
    });
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
