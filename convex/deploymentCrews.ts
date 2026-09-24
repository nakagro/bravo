import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireModuleAccess } from "./modules";

// Crewing is planned by the same people who see the Availability Admin tab.
const CREWING_MODULE = "availabilityAdmin";
const DENIED = "You do not have permission to crew appliances";

const MAX_CREW_MEMBERS = 3;
const MAX_NAME_LENGTH = 60;
const MAX_NOTES_LENGTH = 500;

function normalizeToMidnight(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

const crewFields = {
  date: v.number(),
  applianceName: v.string(),
  driverId: v.optional(v.id("users")),
  crewLeaderId: v.optional(v.id("users")),
  crewMemberIds: v.array(v.id("users")),
  notes: v.optional(v.string()),
};

const seatValidator = v.union(
  v.null(),
  v.object({ userId: v.id("users"), name: v.string() }),
);

async function validateCrew(
  ctx: MutationCtx,
  args: {
    applianceName: string;
    driverId?: Id<"users">;
    crewLeaderId?: Id<"users">;
    crewMemberIds: Id<"users">[];
    notes?: string;
  },
) {
  const applianceName = args.applianceName.trim();
  if (!applianceName) throw new Error("Give the appliance a name");
  if (applianceName.length > MAX_NAME_LENGTH) {
    throw new Error(`Appliance name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
  if (args.crewMemberIds.length > MAX_CREW_MEMBERS) {
    throw new Error(`An appliance takes at most ${MAX_CREW_MEMBERS} crew members`);
  }
  const notes = args.notes?.trim() || undefined;
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer`);
  }

  const seated = [args.driverId, args.crewLeaderId, ...args.crewMemberIds].filter(
    (id): id is Id<"users"> => id !== undefined,
  );
  if (new Set(seated).size !== seated.length) {
    throw new Error("A member can only take one seat on the appliance");
  }
  for (const id of seated) {
    if (!(await ctx.db.get(id))) throw new Error("One of the chosen members no longer exists");
  }

  return {
    applianceName,
    driverId: args.driverId,
    crewLeaderId: args.crewLeaderId,
    crewMemberIds: args.crewMemberIds,
    notes,
  };
}

function displayName(user: Doc<"users"> | null | undefined): string {
  if (!user) return "Unknown member";
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  return user.name || "Unknown member";
}

/** Every crewed appliance in the window, for any signed-in member. */
export const listCrews = query({
  args: { startDate: v.number(), endDate: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("deploymentCrews"),
      date: v.number(),
      applianceName: v.string(),
      driver: seatValidator,
      crewLeader: seatValidator,
      crewMembers: v.array(v.object({ userId: v.id("users"), name: v.string() })),
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

    const userIds = new Set<Id<"users">>();
    for (const crew of crews) {
      if (crew.driverId) userIds.add(crew.driverId);
      if (crew.crewLeaderId) userIds.add(crew.crewLeaderId);
      crew.crewMemberIds.forEach((id) => userIds.add(id));
      userIds.add(crew.updatedBy);
    }
    const users = new Map<Id<"users">, Doc<"users"> | null>();
    await Promise.all(
      [...userIds].map(async (id) => users.set(id, await ctx.db.get(id))),
    );
    const seat = (id: Id<"users"> | undefined) =>
      id ? { userId: id, name: displayName(users.get(id)) } : null;

    return crews
      .map((crew) => ({
        _id: crew._id,
        date: crew.date,
        applianceName: crew.applianceName,
        driver: seat(crew.driverId),
        crewLeader: seat(crew.crewLeaderId),
        crewMembers: crew.crewMemberIds.map((id) => ({ userId: id, name: displayName(users.get(id)) })),
        notes: crew.notes,
        updatedAt: crew.updatedAt,
        updatedByName: displayName(users.get(crew.updatedBy)),
      }))
      .sort((a, b) => a.date - b.date || a.applianceName.localeCompare(b.applianceName));
  },
});

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
