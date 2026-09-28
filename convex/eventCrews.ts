import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { attendanceFor, eventManagerId, requireEventManager } from "./events";
import { crewSeatFields, seatOutput, seatResolver, validateCrew } from "./lib/crewSeats";
import { MAX_APPLIANCES_PER_EVENT } from "./lib/eventCrews";

// Appliances crewed for an event. Managed by whoever manages the event
// (organiser, team leaders, eventsAdmin); visible to every signed-in member.
// Independent of the event roster - see the eventCrews table.

/** Every appliance crewed for an event, in the order they were added. */
export const listEventCrews = query({
  args: { eventId: v.id("events") },
  returns: v.array(
    v.object({
      _id: v.id("eventCrews"),
      applianceName: v.string(),
      crewLeader: v.union(v.null(), seatOutput),
      driver: v.union(v.null(), seatOutput),
      crewMembers: v.array(seatOutput),
      notes: v.optional(v.string()),
      updatedAt: v.number(),
      updatedByName: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
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

export const saveEventCrew = mutation({
  args: {
    eventId: v.id("events"),
    crewId: v.optional(v.id("eventCrews")),
    ...crewSeatFields,
  },
  returns: v.id("eventCrews"),
  handler: async (ctx, { eventId, crewId, ...args }) => {
    const { userId } = await requireEventManager(ctx, eventId);
    const fields = await validateCrew(ctx, args);

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
    if (crewId) {
      const existing = await ctx.db.get(crewId);
      if (!existing || existing.eventId !== eventId) {
        throw new Error("That crew has been removed");
      }
      // replace, not patch, so clearing a seat actually clears it
      await ctx.db.replace(crewId, {
        ...fields,
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
