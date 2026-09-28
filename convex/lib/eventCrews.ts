import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { cleanApplianceName, filledSeats, seatOf, SEATS_PER_APPLIANCE } from "./crewSeats";

// Kept out of convex/eventCrews.ts so events.ts can use these without the two
// modules importing each other.

export const MAX_APPLIANCES_PER_EVENT = 6;

const nameKey = (name: string) => name.trim().toLowerCase();

async function crewsFor(ctx: QueryCtx, eventId: Id<"events">) {
  return await ctx.db
    .query("eventCrews")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(MAX_APPLIANCES_PER_EVENT * 2);
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
  for (const crew of removed) await ctx.db.delete(crew._id);

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
  for (const crew of await crewsFor(ctx, eventId)) await ctx.db.delete(crew._id);
}

/**
 * The per-event crew summary the events lists and detail page carry: each
 * appliance's filled seats, and the caller's own seat if they have one.
 */
export async function crewSummaryFor(ctx: QueryCtx, eventId: Id<"events">, userId: Id<"users">) {
  const crews = (await crewsFor(ctx, eventId)).sort(
    (a, b) => a._creationTime - b._creationTime
  );
  let mySeat: { applianceName: string; role: string } | null = null;
  for (const crew of crews) {
    const role = seatOf(crew, userId);
    if (role && !mySeat) mySeat = { applianceName: crew.applianceName, role };
  }
  return {
    crews: crews.map((crew) => ({
      applianceName: crew.applianceName,
      filled: filledSeats(crew),
      total: SEATS_PER_APPLIANCE,
    })),
    mySeat,
  };
}
