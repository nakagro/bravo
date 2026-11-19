import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { cleanApplianceName, filledSeats, seatOf, SEATS_PER_APPLIANCE } from "./crewSeats";

// Kept out of convex/eventCrews.ts so events.ts can use these without the two
// modules importing each other.

export const MAX_APPLIANCES_PER_EVENT = 6;
/** Bound for one event's shift crews: every appliance on a long roster. */
export const MAX_SHIFT_CREWS_PER_EVENT = MAX_APPLIANCES_PER_EVENT * 50;

const nameKey = (name: string) => name.trim().toLowerCase();

async function crewsFor(ctx: QueryCtx, eventId: Id<"events">) {
  return await ctx.db
    .query("eventCrews")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(MAX_APPLIANCES_PER_EVENT * 2);
}

export async function shiftCrewsFor(ctx: QueryCtx, eventId: Id<"events">) {
  return await ctx.db
    .query("eventShiftCrews")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(MAX_SHIFT_CREWS_PER_EVENT);
}

/** Every shift crew of one appliance, for the cascade when it's removed. */
export async function deleteShiftCrewsOfCrew(ctx: MutationCtx, crew: Doc<"eventCrews">) {
  for (const row of await shiftCrewsFor(ctx, crew.eventId)) {
    if (row.crewId === crew._id) await ctx.db.delete(row._id);
  }
}

/** Every crew on one shift, for the cascade when the shift is removed. */
export async function deleteShiftCrewsOfSlot(ctx: MutationCtx, slotId: Id<"eventSlots">) {
  const rows = await ctx.db
    .query("eventShiftCrews")
    .withIndex("by_slot", (q) => q.eq("slotId", slotId))
    .take(MAX_APPLIANCES_PER_EVENT * 2);
  for (const row of rows) await ctx.db.delete(row._id);
}

/**
 * Turning an event's shifts off: its shift crews went with the shifts, so
 * per-shift appliances go back to one (empty) crew for the whole event.
 */
export async function resetPerShiftCrews(ctx: MutationCtx, eventId: Id<"events">) {
  for (const crew of await crewsFor(ctx, eventId)) {
    if (crew.perShift) await ctx.db.patch(crew._id, { perShift: undefined });
  }
}

/** A filled crew as notices and summaries see it, whole-event or one shift. */
export type SeatedCrew = Pick<Doc<"eventCrews">, "applianceName" | "crewLeader" | "driver" | "crewMembers"> & {
  slot?: Doc<"eventSlots">;
};

/**
 * Every crew with seats on an event: whole-event appliances, then each
 * per-shift appliance's shift crews in shift order. The one place that knows
 * seats can live in two tables - notices, backouts and summaries read this.
 */
export async function seatedCrewsFor(ctx: QueryCtx, eventId: Id<"events">): Promise<SeatedCrew[]> {
  const crews = (await crewsFor(ctx, eventId)).sort((a, b) => a._creationTime - b._creationTime);
  if (!crews.some((crew) => crew.perShift)) return crews;

  const [rows, slots] = await Promise.all([
    shiftCrewsFor(ctx, eventId),
    ctx.db
      .query("eventSlots")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect(),
  ]);
  const slotById = new Map(slots.map((slot) => [slot._id, slot]));
  const out: SeatedCrew[] = [];
  for (const crew of crews) {
    if (!crew.perShift) {
      out.push(crew);
      continue;
    }
    const mine = rows
      .filter((row) => row.crewId === crew._id && slotById.has(row.slotId))
      .map((row) => ({ ...row, applianceName: crew.applianceName, slot: slotById.get(row.slotId)! }))
      .sort((a, b) => a.slot.order - b.slot.order);
    out.push(...mine);
  }
  return out;
}

/**
 * Bring an event's appliances in line with the list the event form sends:
 * add the missing ones as empty crews, remove the ones no longer listed. A
 * listed appliance that already exists keeps its crew untouched.
 */
export async function reconcileCrewAppliances(
  ctx: MutationCtx,
  eventId: Id<"events">,
  names: string[],
  userId: Id<"users">
) {
  const wanted = new Map<string, string>();
  for (const raw of names) {
    const name = cleanApplianceName(raw);
    if (!wanted.has(nameKey(name))) wanted.set(nameKey(name), name);
  }
  if (wanted.size > MAX_APPLIANCES_PER_EVENT) {
    throw new Error(`An event can have at most ${MAX_APPLIANCES_PER_EVENT} appliances`);
  }

  const existing = await crewsFor(ctx, eventId);
  const existingKeys = new Set(existing.map((crew) => nameKey(crew.applianceName)));
  const now = Date.now();

  const removed = existing.filter((crew) => !wanted.has(nameKey(crew.applianceName)));
  for (const crew of removed) {
    await deleteShiftCrewsOfCrew(ctx, crew);
    await ctx.db.delete(crew._id);
  }

  const added: string[] = [];
  for (const [key, applianceName] of wanted) {
    if (existingKeys.has(key)) continue;
    await ctx.db.insert("eventCrews", {
      eventId,
      applianceName,
      crewMembers: [],
      createdBy: userId,
      updatedBy: userId,
      updatedAt: now,
    });
    added.push(applianceName);
  }

  if (added.length > 0 || removed.length > 0) {
    await ctx.db.insert("eventHistory", {
      eventId,
      timestamp: now,
      userId,
      changeType: "crew_change",
      field: "appliances",
      oldValue: existing.map((crew) => crew.applianceName),
      newValue: [...wanted.values()],
    });
  }
}

/** Every crew on an event, for the cascade when the event is deleted. */
export async function deleteEventCrews(ctx: MutationCtx, eventId: Id<"events">) {
  for (const row of await shiftCrewsFor(ctx, eventId)) await ctx.db.delete(row._id);
  for (const crew of await crewsFor(ctx, eventId)) await ctx.db.delete(crew._id);
}

/**
 * The per-event crew summary the events lists and detail page carry: each
 * appliance's filled seats, and the caller's own seat if they have one. A
 * per-shift appliance counts the seats of every shift together.
 */
export async function crewSummaryFor(ctx: QueryCtx, eventId: Id<"events">, userId: Id<"users">) {
  const crews = (await crewsFor(ctx, eventId)).sort(
    (a, b) => a._creationTime - b._creationTime
  );
  const perShift = crews.some((crew) => crew.perShift);
  const [seated, slotCount] = perShift
    ? await Promise.all([
        seatedCrewsFor(ctx, eventId),
        ctx.db
          .query("eventSlots")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect()
          .then((slots) => slots.length),
      ])
    : [crews as SeatedCrew[], 0];

  let mySeat: { applianceName: string; role: string; shiftLabel?: string } | null = null;
  for (const crew of seated) {
    const role = seatOf(crew, userId);
    if (role && !mySeat) {
      mySeat = { applianceName: crew.applianceName, role, shiftLabel: crew.slot?.label };
    }
  }
  return {
    crews: crews.map((crew) => ({
      applianceName: crew.applianceName,
      filled: crew.perShift
        ? seated
            .filter((s) => s.slot && s.applianceName === crew.applianceName)
            .reduce((sum, s) => sum + filledSeats(s), 0)
        : filledSeats(crew),
      total: crew.perShift ? SEATS_PER_APPLIANCE * slotCount : SEATS_PER_APPLIANCE,
    })),
    mySeat,
  };
}
