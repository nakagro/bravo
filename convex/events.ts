import { query, mutation, internalQuery, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";

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

  if (!moduleSetting || !moduleSetting.isEnabled) {
    throw new Error("You do not have access to manage events");
  }

  if (moduleSetting.adminOnly) {
    throw new Error("You do not have access to manage events");
  }

  const hasRoleReq = !!(moduleSetting.requiredRoles && moduleSetting.requiredRoles.length > 0);
  const hasRankReq = !!moduleSetting.minimumRank;

  let roleOk = true;
  if (hasRoleReq) {
    const userRoles = user.roles || [];
    roleOk = moduleSetting.requiredRoles!.some((role: string) => userRoles.includes(role));
  }

  let rankOk = true;
  if (hasRankReq) {
    const rankOrder: Record<string, number> = {
      Probationary: 1,
      Firefighter: 2,
      Lieutenant: 3,
      Captain: 4,
    };

    const userRank = user.rank;
    if (!userRank) {
      rankOk = false;
    } else {
      rankOk = rankOrder[userRank] >= rankOrder[moduleSetting.minimumRank!];
    }
  }

  if (!(roleOk && rankOk)) {
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

// Today as a YYYY-MM-DD string in AEST (same hardcoded UTC+10 assumption as
// crons.ts — drifts 1h during AEDT, accepted)
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
  status: v.union(v.literal("active"), v.literal("cancelled")),
  startDate: v.string(),
  endDate: v.optional(v.string()),
  startTime: v.optional(v.string()),
  endTime: v.optional(v.string()),
  respondBy: v.optional(v.string()),
  hasShifts: v.optional(v.boolean()),
  isAllDay: v.boolean(),
  cancelledBy: v.optional(v.id("users")),
  cancelledAt: v.optional(v.number()),
  cancellationReason: v.optional(v.string()),
  reminderSentAt: v.optional(v.number()),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  counts: v.object({
    attending: v.number(),
    notAttending: v.number(),
    maybe: v.number(),
  }),
  myRsvp: v.union(rsvpStatusValidator, v.null()),
  createdByUser: v.optional(userNameValidator),
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
 * The set of users who count as "going" to a slot event — anyone who expressed
 * interest OR was allocated by an admin (an admin may roster someone who never
 * ticked interest).
 */
async function slotAttendingUserIds(
  ctx: QueryCtx,
  eventId: Id<"events">
): Promise<Set<Id<"users">>> {
  const [interest, allocations] = await Promise.all([
    ctx.db
      .query("eventSlotResponses")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect(),
    ctx.db
      .query("eventSlotAllocations")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect(),
  ]);
  const ids = new Set<Id<"users">>();
  for (const r of interest) ids.add(r.userId);
  for (const a of allocations) ids.add(a.userId);
  return ids;
}

async function enrichEvent(ctx: QueryCtx, event: Doc<"events">, userId: Id<"users">) {
  const rsvps = await ctx.db
    .query("eventRsvps")
    .withIndex("by_event", (q) => q.eq("eventId", event._id))
    .collect();

  const counts = { attending: 0, notAttending: 0, maybe: 0 };
  let myRsvp: "attending" | "notAttending" | "maybe" | null = null;

  if (event.hasShifts) {
    // Slot event: "going" = interested ∪ allocated, not a top-level attending
    // rsvp. "Can't make it" is still a notAttending rsvp.
    const attendingUsers = await slotAttendingUserIds(ctx, event._id);
    counts.attending = attendingUsers.size;
    for (const rsvp of rsvps) {
      if (rsvp.status === "notAttending") counts.notAttending++;
    }
    if (attendingUsers.has(userId)) {
      myRsvp = "attending";
    } else if (rsvps.some((r) => r.userId === userId && r.status === "notAttending")) {
      myRsvp = "notAttending";
    }
  } else {
    for (const rsvp of rsvps) {
      counts[rsvp.status]++;
      if (rsvp.userId === userId) {
        myRsvp = rsvp.status;
      }
    }
  }

  const createdByUser = await ctx.db.get(event.createdBy);

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
 * Reconcile an event's slots to the desired list (insert new, patch existing by
 * _id, delete removed). Deleting a slot cascade-deletes its responses. Slot
 * order follows array order.
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

  // Delete slots the organiser removed, plus their responses
  for (const slot of existing) {
    if (!keepIds.has(slot._id)) {
      const responses = await ctx.db
        .query("eventSlotResponses")
        .withIndex("by_slot", (q) => q.eq("slotId", slot._id))
        .collect();
      for (const response of responses) {
        await ctx.db.delete(response._id);
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

    const events = await ctx.db
      .query("events")
      .withIndex("by_startDate", (q) => q.gte("startDate", args.fromDate))
      .order("asc")
      .collect();

    return await Promise.all(events.map((event) => enrichEvent(ctx, event, userId)));
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

    const events = await ctx.db
      .query("events")
      .withIndex("by_startDate", (q) => q.lt("startDate", args.beforeDate))
      .order("desc")
      .take(50);

    return await Promise.all(events.map((event) => enrichEvent(ctx, event, userId)));
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

    const term = args.search?.trim();

    if (term) {
      // Search index can't express the "past only" date range, so we match on
      // title and filter future events out of each page after the fact.
      const result = await ctx.db
        .query("events")
        .withSearchIndex("search_title", (q) => q.search("title", term))
        .paginate(args.paginationOpts);
      const past = result.page.filter((event) => event.startDate < args.beforeDate);
      const page = await Promise.all(past.map((event) => enrichEvent(ctx, event, userId)));
      return { page, isDone: result.isDone, continueCursor: result.continueCursor };
    }

    const result = await ctx.db
      .query("events")
      .withIndex("by_startDate", (q) => q.lt("startDate", args.beforeDate))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(result.page.map((event) => enrichEvent(ctx, event, userId)));
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

    return await enrichEvent(ctx, event, userId);
  },
});

/**
 * Attendance for an event. The *attending* list is visible to every signed-in
 * member (it's a turnout tool). The full breakdown — maybe / not going / and
 * especially the non-responders — is sensitive, so it's returned only to
 * eventsAdmin (`breakdown` is null otherwise).
 */
export const getEventAttendance = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.object({
      attending: v.array(userNameValidator),
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

    const rsvps = await ctx.db
      .query("eventRsvps")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const nameOf = (user: Doc<"users">) => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
    });

    // "Going" is interested ∪ allocated for slot events, an attending rsvp
    // otherwise.
    let attendingIds: Set<Id<"users">>;
    if (event.hasShifts) {
      attendingIds = await slotAttendingUserIds(ctx, args.eventId);
    } else {
      attendingIds = new Set(
        rsvps.filter((rsvp) => rsvp.status === "attending").map((rsvp) => rsvp.userId)
      );
    }

    // Attending list — visible to all signed-in members
    const attending = (
      await Promise.all([...attendingIds].map((id) => ctx.db.get(id)))
    )
      .filter((user): user is Doc<"users"> => user !== null)
      .map(nameOf);

    // Full breakdown (incl. non-responders) is admin-only
    const isAdmin = (await hasEventsAdmin(ctx)) !== null;
    if (!isAdmin) {
      return { attending, breakdown: null };
    }

    const rsvpByUser = new Map(rsvps.map((rsvp) => [rsvp.userId, rsvp.status]));
    // "All members" = all users rows (no isActive flag, per bookings.getAllUsers)
    const users = await ctx.db.query("users").collect();

    const maybe: Array<ReturnType<typeof nameOf>> = [];
    const notAttending: Array<ReturnType<typeof nameOf>> = [];
    const noResponse: Array<ReturnType<typeof nameOf>> = [];

    for (const user of users) {
      // Slot responders count as "going" — never double-count them below
      if (attendingIds.has(user._id)) continue;
      const status = rsvpByUser.get(user._id);
      if (status === "maybe") maybe.push(nameOf(user));
      else if (status === "notAttending") notAttending.push(nameOf(user));
      else if (!status) noResponse.push(nameOf(user));
    }

    return {
      attending,
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
    const adminUserId = await hasEventsAdmin(ctx);
    if (!adminUserId) {
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
 * Create a new event (publishes immediately — no draft state).
 */
export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    eventTypeId: v.optional(v.id("eventTypes")),
    location: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    respondBy: v.optional(v.string()),
    hasShifts: v.optional(v.boolean()),
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
      status: "active",
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.startTime,
      endTime: args.endTime,
      respondBy: args.respondBy,
      hasShifts: args.hasShifts,
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
    const userId = await requireEventsAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    const fields = [
      "title",
      "description",
      "eventTypeId",
      "location",
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
    // changes — a slot-only edit must still apply).
    if (args.slots !== undefined) {
      const hasShifts = args.hasShifts ?? event.hasShifts ?? false;
      // Turning shifts off clears all slots; otherwise sync to the payload.
      await reconcileSlots(ctx, args.eventId, hasShifts ? args.slots : []);
    }

    if (Object.keys(updateData).length === 0) {
      return null;
    }

    if (updateData.startDate !== undefined && event.reminderSentAt !== undefined) {
      updateData.reminderSentAt = undefined;
    }
    updateData.updatedAt = Date.now();

    await ctx.db.patch(args.eventId, updateData);
    return null;
  },
});

/**
 * Cancel an event. Stays visible with a badge (no hard delete — preserves the
 * audit trail). Does not auto-notify; the organiser uses the Notify action.
 */
export const cancelEvent = mutation({
  args: {
    eventId: v.id("events"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireEventsAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
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
    const userId = await requireEventsAdmin(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }
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
    await requireOpenEvent(ctx, slot.eventId);

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
 * Admin: place or remove a member on a slot (the official roster). Allocation
 * is independent of interest — anyone can be placed. Returns the new state.
 */
export const toggleSlotAllocation = mutation({
  args: {
    slotId: v.id("eventSlots"),
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const adminId = await requireEventsAdmin(ctx);

    const slot = await ctx.db.get(args.slotId);
    if (!slot) {
      throw new Error("Shift not found");
    }

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
 * Slots for an event (member-facing), ordered. Each carries the official
 * **allocated** roster (member-visible) and coverage, plus whether the caller
 * is interested in / allocated to it. The full "who's interested" list is
 * admin-only — see getSlotRoster. Empty for non-slot events.
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
      allocated: v.array(userNameValidator),
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

    return await Promise.all(
      slots.map(async (slot) => {
        const allocations = await ctx.db
          .query("eventSlotAllocations")
          .withIndex("by_slot", (q) => q.eq("slotId", slot._id))
          .collect();
        const allocated = (
          await Promise.all(allocations.map((a) => ctx.db.get(a.userId)))
        )
          .filter((user): user is Doc<"users"> => user !== null)
          .map((user) => ({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
          }));

        const myInterest = await ctx.db
          .query("eventSlotResponses")
          .withIndex("by_slot_user", (q) => q.eq("slotId", slot._id).eq("userId", userId))
          .first();

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
          mineInterested: myInterest !== null,
          mineAllocated: allocations.some((a) => a.userId === userId),
        };
      })
    );
  },
});

/**
 * Admin roster view for the allocation UI: all members plus, per slot, who is
 * interested and who is allocated. Returns null for non-admins.
 */
export const getSlotRoster = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.object({
      members: v.array(userNameValidator),
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
    const adminId = await hasEventsAdmin(ctx);
    if (!adminId) {
      return null;
    }

    const users = await ctx.db.query("users").collect();
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

    return { members, slots: slotsWithRoster };
  },
});

// ─── Internal functions for the reminder pipeline ───────────────────────────

/**
 * Active events on targetDate that haven't had their reminder sent yet,
 * each with its RSVPs, plus all user ids (for non-responder nudges).
 */
export const getReminderTargets = internalQuery({
  args: { targetDate: v.string() },
  returns: v.object({
    events: v.array(
      v.object({
        _id: v.id("events"),
        title: v.string(),
        location: v.optional(v.string()),
        startTime: v.optional(v.string()),
        isAllDay: v.boolean(),
        rsvps: v.array(
          v.object({
            userId: v.id("users"),
            status: rsvpStatusValidator,
          })
        ),
      })
    ),
    allUserIds: v.array(v.id("users")),
  }),
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_status_startDate", (q) =>
        q.eq("status", "active").eq("startDate", args.targetDate)
      )
      .collect();

    const pendingEvents = events.filter((event) => event.reminderSentAt === undefined);

    const eventsWithRsvps = await Promise.all(
      pendingEvents.map(async (event) => {
        const rsvps = await ctx.db
          .query("eventRsvps")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect();

        const statusByUser = new Map<Id<"users">, "attending" | "notAttending" | "maybe">(
          rsvps.map((rsvp) => [rsvp.userId, rsvp.status])
        );

        // For slot events, interested ∪ allocated is the "attending" signal —
        // fold each distinct user in so they're reminded (and excluded from
        // non-responder nudges).
        if (event.hasShifts) {
          const attendingUsers = await slotAttendingUserIds(ctx, event._id);
          for (const id of attendingUsers) {
            if (!statusByUser.has(id)) {
              statusByUser.set(id, "attending");
            }
          }
        }

        return {
          _id: event._id,
          title: event.title,
          location: event.location,
          startTime: event.startTime,
          isAllDay: event.isAllDay,
          rsvps: [...statusByUser.entries()].map(([userId, status]) => ({ userId, status })),
        };
      })
    );

    const users = await ctx.db.query("users").collect();

    return {
      events: eventsWithRsvps,
      allUserIds: users.map((user) => user._id),
    };
  },
});

/**
 * Mark an event's reminder as sent (at-most-once delivery guard).
 */
export const markReminderSent = internalMutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { reminderSentAt: Date.now() });
    return null;
  },
});

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
