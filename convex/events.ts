import { query, mutation, internalQuery, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
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
async function requireEventsAdmin(ctx: QueryCtx | MutationCtx) {
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
async function hasEventsAdmin(ctx: QueryCtx): Promise<Id<"users"> | null> {
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
  location: v.optional(v.string()),
  status: v.union(v.literal("active"), v.literal("cancelled")),
  startDate: v.string(),
  endDate: v.optional(v.string()),
  startTime: v.optional(v.string()),
  endTime: v.optional(v.string()),
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
});

async function enrichEvent(ctx: QueryCtx, event: Doc<"events">, userId: Id<"users">) {
  const rsvps = await ctx.db
    .query("eventRsvps")
    .withIndex("by_event", (q) => q.eq("eventId", event._id))
    .collect();

  const counts = { attending: 0, notAttending: 0, maybe: 0 };
  let myRsvp: "attending" | "notAttending" | "maybe" | null = null;
  for (const rsvp of rsvps) {
    counts[rsvp.status]++;
    if (rsvp.userId === userId) {
      myRsvp = rsvp.status;
    }
  }

  const createdByUser = await ctx.db.get(event.createdBy);

  return {
    ...event,
    counts,
    myRsvp,
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
 * Get grouped attendance name lists for an event, including members who
 * haven't responded. Visible to all signed-in members.
 */
export const getEventAttendance = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.object({
      attending: v.array(userNameValidator),
      maybe: v.array(userNameValidator),
      notAttending: v.array(userNameValidator),
      noResponse: v.array(userNameValidator),
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
    const rsvpByUser = new Map(rsvps.map((rsvp) => [rsvp.userId, rsvp.status]));

    // "All members" = all users rows (no isActive flag, per bookings.getAllUsers)
    const users = await ctx.db.query("users").collect();

    const groups = {
      attending: [] as Array<{ _id: Id<"users">; firstName?: string; lastName?: string; name?: string }>,
      maybe: [] as Array<{ _id: Id<"users">; firstName?: string; lastName?: string; name?: string }>,
      notAttending: [] as Array<{ _id: Id<"users">; firstName?: string; lastName?: string; name?: string }>,
      noResponse: [] as Array<{ _id: Id<"users">; firstName?: string; lastName?: string; name?: string }>,
    };

    for (const user of users) {
      const entry = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
      };
      const status = rsvpByUser.get(user._id);
      if (status) {
        groups[status].push(entry);
      } else {
        groups.noResponse.push(entry);
      }
    }

    return groups;
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
    eventType: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    isAllDay: v.boolean(),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const userId = await requireEventsAdmin(ctx);

    const now = Date.now();
    const eventId = await ctx.db.insert("events", {
      title: args.title,
      description: args.description,
      eventType: args.eventType,
      location: args.location,
      status: "active",
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.startTime,
      endTime: args.endTime,
      isAllDay: args.isAllDay,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

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
    eventType: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
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
      "eventType",
      "location",
      "startDate",
      "endDate",
      "startTime",
      "endTime",
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
        return {
          _id: event._id,
          title: event.title,
          location: event.location,
          startTime: event.startTime,
          isAllDay: event.isAllDay,
          rsvps: rsvps.map((rsvp) => ({ userId: rsvp.userId, status: rsvp.status })),
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
