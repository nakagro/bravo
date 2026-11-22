import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { attendanceFor, eventManagerId, requireEventManager } from "./events";
import {
  crewSeatFields,
  filledSeats,
  seatOutput,
  seatResolver,
  seatValidator,
  validateCrew,
} from "./lib/crewSeats";
import { deleteShiftCrewsOfCrew, MAX_APPLIANCES_PER_EVENT, shiftCrewsFor } from "./lib/eventCrews";
import { getModuleUser } from "./lib/access";

// Appliances crewed for an event. Managed by whoever manages the event
// (organiser, team leaders, eventsAdmin); visible to every signed-in member.
// Independent of the event roster - see the eventCrews table. On a shift event
// an appliance can be crewed per shift: its seats then live on eventShiftCrews.

/** Every appliance crewed for an event, in the order they were added. */
export const listEventCrews = query({
  args: { eventId: v.id("events") },
  returns: v.array(
    v.object({
      _id: v.id("eventCrews"),
      applianceName: v.string(),
      perShift: v.boolean(),
      crewLeader: v.union(v.null(), seatOutput),
      driver: v.union(v.null(), seatOutput),
      crewMembers: v.array(seatOutput),
      notes: v.optional(v.string()),
      updatedAt: v.number(),
      updatedByName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = (await getModuleUser(ctx, "events"))?._id;
    if (!userId) return [];

    const crews = (
      await ctx.db
        .query("eventCrews")
        .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
        .take(MAX_APPLIANCES_PER_EVENT * 2)
    ).sort((a, b) => a._creationTime - b._creationTime);

    const { resolve, userName } = await seatResolver(
      ctx,
      crews,
      crews.map((crew) => crew.updatedBy)
    );

    return crews.map((crew) => ({
      _id: crew._id,
      applianceName: crew.applianceName,
      perShift: crew.perShift ?? false,
      crewLeader: crew.crewLeader ? resolve(crew.crewLeader) : null,
      driver: crew.driver ? resolve(crew.driver) : null,
      crewMembers: crew.crewMembers.map(resolve),
      notes: crew.notes,
      updatedAt: crew.updatedAt,
      updatedByName: userName(crew.updatedBy),
    }));
  },
});

/**
 * Who has said they're going to the event, and who can't make it, so the seat
 * picker can list likely crew first. Managers only - it's their tool.
 */
export const getCrewPickerStatus = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      going: v.array(v.id("users")),
      maybe: v.array(v.id("users")),
      declined: v.array(v.id("users")),
    })
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || !(await eventManagerId(ctx, event))) return null;
    const { going, declined, rsvps } = await attendanceFor(ctx, event);
    return {
      going: [...going],
      maybe: rsvps.filter((r) => r.status === "maybe").map((r) => r.userId),
      declined: [...declined],
    };
  },
});

// Saving does not notify anyone. Members are told only when the sender
// confirms a send from SendAssignmentsSheet (convex/assignmentNotices.ts).
export const saveEventCrew = mutation({
  args: {
    eventId: v.id("events"),
    crewId: v.optional(v.id("eventCrews")),
    ...crewSeatFields,
    // Crew each shift separately (shift events only). Omitted = unchanged on
    // an edit, whole event on a new appliance.
    perShift: v.optional(v.boolean()),
  },
  returns: v.id("eventCrews"),
  handler: async (ctx, { eventId, crewId, perShift: perShiftArg, ...args }) => {
    const { userId } = await requireEventManager(ctx, eventId);
    const fields = await validateCrew(ctx, args);
    const existing = crewId ? await ctx.db.get(crewId) : null;
    if (crewId && (!existing || existing.eventId !== eventId)) {
      throw new Error("That crew has been removed");
    }
    const perShift = perShiftArg ?? existing?.perShift ?? false;
    if (perShift) {
      const event = await ctx.db.get(eventId);
      if (!event?.hasShifts) throw new Error("Only an event with shifts can crew an appliance per shift");
      // The seats are per shift now; the appliance row keeps none of its own.
      if (filledSeats(fields) > 0) {
        throw new Error("Clear the whole-event seats before crewing this appliance per shift");
      }
    } else if (existing?.perShift) {
      // Going back to one crew: refuse rather than guess which shift's crew to keep.
      const rows = (await shiftCrewsFor(ctx, eventId)).filter((row) => row.crewId === existing._id);
      if (rows.some((row) => filledSeats(row) > 0)) {
        throw new Error("Clear the shift crews before crewing this appliance for the whole event");
      }
      for (const row of rows) await ctx.db.delete(row._id);
    }

    const siblings = await ctx.db
      .query("eventCrews")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .take(MAX_APPLIANCES_PER_EVENT * 2);
    const clash = siblings.find(
      (crew) =>
        crew._id !== crewId &&
        crew.applianceName.toLowerCase() === fields.applianceName.toLowerCase()
    );
    if (clash) throw new Error(`This event already has a crew for ${clash.applianceName}`);

    const now = Date.now();
    let savedId = crewId;
    if (crewId && existing) {
      // replace, not patch, so clearing a seat actually clears it
      await ctx.db.replace(crewId, {
        ...fields,
        perShift: perShift || undefined,
        eventId,
        createdBy: existing.createdBy,
        updatedBy: userId,
        updatedAt: now,
      });
    } else {
      if (siblings.length >= MAX_APPLIANCES_PER_EVENT) {
        throw new Error(`An event can have at most ${MAX_APPLIANCES_PER_EVENT} appliances`);
      }
      savedId = await ctx.db.insert("eventCrews", {
        ...fields,
        perShift: perShift || undefined,
        eventId,
        createdBy: userId,
        updatedBy: userId,
        updatedAt: now,
      });
    }

    await ctx.db.insert("eventHistory", {
      eventId,
      timestamp: now,
      userId,
      changeType: "crew_change",
      field: fields.applianceName,
      oldValue: null,
      newValue: crewId ? "crew updated" : "appliance added",
    });
    return savedId!;
  },
});

export const removeEventCrew = mutation({
  args: { crewId: v.id("eventCrews") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const crew = await ctx.db.get(args.crewId);
    if (!crew) return null;
    const { userId } = await requireEventManager(ctx, crew.eventId);
    await deleteShiftCrewsOfCrew(ctx, crew);
    await ctx.db.delete(crew._id);
    await ctx.db.insert("eventHistory", {
      eventId: crew.eventId,
      timestamp: Date.now(),
      userId,
      changeType: "crew_change",
      field: crew.applianceName,
      oldValue: "appliance",
      newValue: "removed",
    });
    return null;
  },
});

/**
 * The filled shift crews of an event's per-shift appliances. A shift with no
 * row has nobody on that appliance yet.
 */
export const listShiftCrews = query({
  args: { eventId: v.id("events") },
  returns: v.array(
    v.object({
      crewId: v.id("eventCrews"),
      slotId: v.id("eventSlots"),
      crewLeader: v.union(v.null(), seatOutput),
      driver: v.union(v.null(), seatOutput),
      crewMembers: v.array(seatOutput),
    })
  ),
  handler: async (ctx, args) => {
    const userId = (await getModuleUser(ctx, "events"))?._id;
    if (!userId) return [];
    const rows = await shiftCrewsFor(ctx, args.eventId);
    const { resolve } = await seatResolver(ctx, rows);
    return rows.map((row) => ({
      crewId: row.crewId,
      slotId: row.slotId,
      crewLeader: row.crewLeader ? resolve(row.crewLeader) : null,
      driver: row.driver ? resolve(row.driver) : null,
      crewMembers: row.crewMembers.map(resolve),
    }));
  },
});

// Like saveEventCrew, saving doesn't notify anyone.
export const saveShiftCrew = mutation({
  args: {
    crewId: v.id("eventCrews"),
    slotId: v.id("eventSlots"),
    driver: v.optional(seatValidator),
    crewLeader: v.optional(seatValidator),
    crewMembers: v.array(seatValidator),
  },
  returns: v.null(),
  handler: async (ctx, { crewId, slotId, ...seats }) => {
    const crew = await ctx.db.get(crewId);
    if (!crew) throw new Error("That appliance has been removed");
    const { userId } = await requireEventManager(ctx, crew.eventId);
    if (!crew.perShift) throw new Error(`${crew.applianceName} isn't crewed per shift`);
    const slot = await ctx.db.get(slotId);
    if (!slot || slot.eventId !== crew.eventId) throw new Error("That shift has been removed");

    const { driver, crewLeader, crewMembers } = await validateCrew(ctx, {
      applianceName: crew.applianceName,
      ...seats,
    });
    const existing = await ctx.db
      .query("eventShiftCrews")
      .withIndex("by_crew_and_slot", (q) => q.eq("crewId", crewId).eq("slotId", slotId))
      .unique();
    const now = Date.now();
    const fields = { driver, crewLeader, crewMembers };

    if (filledSeats(fields) === 0) {
      if (existing) await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.replace(existing._id, {
        eventId: crew.eventId,
        crewId,
        slotId,
        ...fields,
        updatedBy: userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("eventShiftCrews", {
        eventId: crew.eventId,
        crewId,
        slotId,
        ...fields,
        updatedBy: userId,
        updatedAt: now,
      });
    }

    await ctx.db.insert("eventHistory", {
      eventId: crew.eventId,
      timestamp: now,
      userId,
      changeType: "crew_change",
      field: `${crew.applianceName} · ${slot.label}`,
      oldValue: null,
      newValue: "crew updated",
    });
    return null;
  },
});
