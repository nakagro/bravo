import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

// Seats on a crewed appliance, shared by Deployment → Crews (strike teams)
// and appliance crews on events: Crew Leader, Driver and up to three crew.

export const MAX_CREW_MEMBERS = 3;
export const MAX_NAME_LENGTH = 60;
export const MAX_NOTES_LENGTH = 500;
/** Crew Leader + Driver + crew */
export const SEATS_PER_APPLIANCE = 2 + MAX_CREW_MEMBERS;

// A BRAVO member, or a typed name for someone from another brigade.
export const seatValidator = v.union(
  v.object({ userId: v.id("users") }),
  v.object({ name: v.string() }),
);
export type Seat = Infer<typeof seatValidator>;

export const seatOutput = v.object({
  userId: v.optional(v.id("users")),
  name: v.string(),
  external: v.boolean(),
});

export const crewSeatFields = {
  applianceName: v.string(),
  driver: v.optional(seatValidator),
  crewLeader: v.optional(seatValidator),
  crewMembers: v.array(seatValidator),
  notes: v.optional(v.string()),
};

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

export function cleanApplianceName(raw: string) {
  const applianceName = raw.trim();
  if (!applianceName) throw new Error("Give the appliance a name");
  if (applianceName.length > MAX_NAME_LENGTH) {
    throw new Error(`Appliance name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
  return applianceName;
}

export async function validateCrew(
  ctx: MutationCtx,
  args: {
    applianceName: string;
    driver?: Seat;
    crewLeader?: Seat;
    crewMembers: Seat[];
    notes?: string;
  },
) {
  const applianceName = cleanApplianceName(args.applianceName);
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

export function displayName(user: Doc<"users"> | null | undefined): string {
  if (!user) return "Unknown member";
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  return user.name || "Unknown member";
}

type CrewSeats = {
  driver?: Seat;
  crewLeader?: Seat;
  crewMembers: Seat[];
};

/** How many of an appliance's seats are taken. */
export const filledSeats = (crew: CrewSeats) =>
  (crew.driver ? 1 : 0) + (crew.crewLeader ? 1 : 0) + crew.crewMembers.length;

/** The seat a member holds on a crew, if any, as a display label. */
export function seatOf(crew: CrewSeats, userId: Id<"users">): string | null {
  const is = (seat?: Seat) => !!seat && "userId" in seat && seat.userId === userId;
  if (is(crew.crewLeader)) return "Crew Leader";
  if (is(crew.driver)) return "Driver";
  return crew.crewMembers.some(is) ? "Crew" : null;
}

/**
 * Resolves seats to display names, reading each member once however many
 * crews they appear on.
 */
export async function seatResolver(ctx: QueryCtx, crews: CrewSeats[], extraUserIds: Id<"users">[] = []) {
  const userIds = new Set<Id<"users">>(extraUserIds);
  for (const crew of crews) {
    for (const seat of [crew.driver, crew.crewLeader, ...crew.crewMembers]) {
      if (seat && "userId" in seat) userIds.add(seat.userId);
    }
  }
  const users = new Map<Id<"users">, Doc<"users"> | null>();
  await Promise.all([...userIds].map(async (id) => users.set(id, await ctx.db.get(id))));
  const resolve = (seat: Seat) =>
    "userId" in seat
      ? { userId: seat.userId, name: displayName(users.get(seat.userId)), external: false }
      : { name: seat.name, external: true };
  return { resolve, userName: (id: Id<"users">) => displayName(users.get(id)) };
}
