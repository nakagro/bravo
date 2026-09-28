import type { Id } from "../../../../convex/_generated/dataModel";

// Seats on a crewed appliance, shared by Availability → Deployment → Crews and
// appliance crews on events. Mirrors convex/lib/crewSeats.ts.

export const BRIGADE_NAME = "Wyndham Vale";
export const QUICK_APPLIANCES = ["Pumper", "Tanker", "FCV"];
export const CREW_SEATS = 3;

/** The full name a quick-pick chip stands for, e.g. "Wyndham Vale Pumper". */
export const quickApplianceName = (appliance: string) => `${BRIGADE_NAME} ${appliance}`;

/** A seat holds a BRAVO member or, for crew from another brigade, a typed name. */
export interface SeatDraft {
  userId: Id<"users"> | null;
  name: string;
}

export const emptySeat = (): SeatDraft => ({ userId: null, name: "" });

export interface CrewSeatsDraft {
  crewLeader: SeatDraft;
  driver: SeatDraft;
  crewMembers: SeatDraft[];
}

export const emptySeats = (): CrewSeatsDraft => ({
  crewLeader: emptySeat(),
  driver: emptySeat(),
  crewMembers: Array.from({ length: CREW_SEATS }, emptySeat),
});

/** A seat as the crew queries return it. */
export interface SeatView {
  userId?: Id<"users">;
  name: string;
  external: boolean;
}

export function toSeatDraft(seat: SeatView | null | undefined): SeatDraft {
  if (!seat) return emptySeat();
  return seat.external
    ? { userId: null, name: seat.name }
    : { userId: seat.userId ?? null, name: "" };
}

/** The seats of a saved crew, padded out to every crew position. */
export const toSeatsDraft = (crew: {
  crewLeader: SeatView | null;
  driver: SeatView | null;
  crewMembers: SeatView[];
}): CrewSeatsDraft => ({
  crewLeader: toSeatDraft(crew.crewLeader),
  driver: toSeatDraft(crew.driver),
  crewMembers: Array.from({ length: CREW_SEATS }, (_, i) => toSeatDraft(crew.crewMembers[i])),
});

export function toSeat(seat: SeatDraft) {
  if (seat.userId) return { userId: seat.userId };
  const name = seat.name.trim();
  return name ? { name } : undefined;
}

/** The seats in the shape the save mutations take. */
export const seatsPayload = (seats: CrewSeatsDraft) => ({
  driver: toSeat(seats.driver),
  crewLeader: toSeat(seats.crewLeader),
  crewMembers: seats.crewMembers.flatMap((seat) => toSeat(seat) ?? []),
});

/** Convex error text without the "Uncaught Error:" wrapper and stack. */
export const saveErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : "";
