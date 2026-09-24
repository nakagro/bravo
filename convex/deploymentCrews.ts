import { query, mutation, type MutationCtx } from "./_generated/server";
import { v, type Infer } from "convex/values";
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

// A BRAVO member, or a typed name for someone from another brigade.
const seatValidator = v.union(
  v.object({ userId: v.id("users") }),
  v.object({ name: v.string() }),
);
type Seat = Infer<typeof seatValidator>;

const crewFields = {
  date: v.number(),
  applianceName: v.string(),
  driver: v.optional(seatValidator),
  crewLeader: v.optional(seatValidator),
  crewMembers: v.array(seatValidator),
  notes: v.optional(v.string()),
};

const seatOutput = v.object({
  userId: v.optional(v.id("users")),
  name: v.string(),
  external: v.boolean(),
});

async function cleanSeat(ctx: MutationCtx, seat: Seat | undefined): Promise<Seat | undefined> {
  if (!seat) return undefined;
  if ("userId" in seat) {
    if (!(await ctx.db.get(seat.userId))) throw new Error("One of the chosen members no longer exists");
    return { userId: seat.userId };
  }
  const name = seat.name.trim();
  if (!name) return undefined;
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Names must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
  return { name };
}

async function validateCrew(
  ctx: MutationCtx,
  args: {
    applianceName: string;
    driver?: Seat;
    crewLeader?: Seat;
    crewMembers: Seat[];
    notes?: string;
  },
) {
  const applianceName = args.applianceName.trim();
  if (!applianceName) throw new Error("Give the appliance a name");
  if (applianceName.length > MAX_NAME_LENGTH) {
    throw new Error(`Appliance name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
  if (args.crewMembers.length > MAX_CREW_MEMBERS) {
    throw new Error(`An appliance takes at most ${MAX_CREW_MEMBERS} crew members`);
  }
  const notes = args.notes?.trim() || undefined;
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer`);
  }

  const driver = await cleanSeat(ctx, args.driver);
  const crewLeader = await cleanSeat(ctx, args.crewLeader);
  const crewMembers: Seat[] = [];
  for (const seat of args.crewMembers) {
    const cleaned = await cleanSeat(ctx, seat);
    if (cleaned) crewMembers.push(cleaned);
  }

  const memberIds = [driver, crewLeader, ...crewMembers].flatMap((s) =>
    s && "userId" in s ? [s.userId] : [],
  );
  if (new Set(memberIds).size !== memberIds.length) {
    throw new Error("A member can only take one seat on the appliance");
  }

  return { applianceName, driver, crewLeader, crewMembers, notes };
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

    const userIds = new Set<Id<"users">>();
    for (const crew of crews) {
      for (const seat of [crew.driver, crew.crewLeader, ...crew.crewMembers]) {
        if (seat && "userId" in seat) userIds.add(seat.userId);
      }
      userIds.add(crew.updatedBy);
    }
    const users = new Map<Id<"users">, Doc<"users"> | null>();
    await Promise.all(
      [...userIds].map(async (id) => users.set(id, await ctx.db.get(id))),
    );
    const resolve = (seat: Seat) =>
      "userId" in seat
        ? { userId: seat.userId, name: displayName(users.get(seat.userId)), external: false }
        : { name: seat.name, external: true };

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
