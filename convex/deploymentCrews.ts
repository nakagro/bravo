import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireModuleAccess } from "./modules";
import { crewSeatFields, seatOutput, seatResolver, validateCrew } from "./lib/crewSeats";

// Crewing is planned by the same people who see the Availability Admin tab.
const CREWING_MODULE = "availabilityAdmin";
const DENIED = "You do not have permission to crew appliances";

function normalizeToMidnight(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

const crewFields = { date: v.number(), ...crewSeatFields };

/** Every crewed appliance in the window, for any signed-in member. */
export const listCrews = query({
  args: { startDate: v.number(), endDate: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("deploymentCrews"),
      date: v.number(),
      applianceName: v.string(),
      driver: v.union(v.null(), seatOutput),
      crewLeader: v.union(v.null(), seatOutput),
      crewMembers: v.array(seatOutput),
      notes: v.optional(v.string()),
      updatedAt: v.number(),
      updatedByName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const crews = await ctx.db
      .query("deploymentCrews")
      .withIndex("by_date", (q) => q.gte("date", args.startDate).lte("date", args.endDate))
      .collect();

    const { resolve, userName } = await seatResolver(
      ctx,
      crews,
      crews.map((crew) => crew.updatedBy),
    );

    return crews
      .map((crew) => ({
        _id: crew._id,
        date: crew.date,
        applianceName: crew.applianceName,
        driver: crew.driver ? resolve(crew.driver) : null,
        crewLeader: crew.crewLeader ? resolve(crew.crewLeader) : null,
        crewMembers: crew.crewMembers.map(resolve),
        notes: crew.notes,
        updatedAt: crew.updatedAt,
        updatedByName: userName(crew.updatedBy),
      }))
      .sort((a, b) => a.date - b.date || a.applianceName.localeCompare(b.applianceName));
  },
});

// Saving does not notify anyone. Members are told only when the sender
// confirms a send from SendAssignmentsSheet (convex/assignmentNotices.ts).
export const createCrew = mutation({
  args: crewFields,
  returns: v.id("deploymentCrews"),
  handler: async (ctx, args) => {
    const userId = await requireModuleAccess(ctx, CREWING_MODULE, DENIED);
    const fields = await validateCrew(ctx, args);
    return await ctx.db.insert("deploymentCrews", {
      ...fields,
      date: normalizeToMidnight(args.date),
      createdBy: userId,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
  },
});

export const updateCrew = mutation({
  args: { crewId: v.id("deploymentCrews"), ...crewFields },
  returns: v.null(),
  handler: async (ctx, { crewId, ...args }) => {
    const userId = await requireModuleAccess(ctx, CREWING_MODULE, DENIED);
    const existing = await ctx.db.get(crewId);
    if (!existing) throw new Error("That crew has been removed");
    const fields = await validateCrew(ctx, args);
    // replace, not patch, so clearing a seat actually clears it
    await ctx.db.replace(crewId, {
      ...fields,
      date: normalizeToMidnight(args.date),
      createdBy: existing.createdBy,
      updatedBy: userId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const deleteCrew = mutation({
  args: { crewId: v.id("deploymentCrews") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireModuleAccess(ctx, CREWING_MODULE, DENIED);
    if (await ctx.db.get(args.crewId)) await ctx.db.delete(args.crewId);
    return null;
  },
});
