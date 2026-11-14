import { errorMessage } from "@/lib/errors";
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
export const saveErrorMessage = (error: unknown) => errorMessage(error, "");

/** A seat on the truck: Crew Leader, Driver, or a Crew position by index. */
export type SeatKey = "crewLeader" | "driver" | number;

export const SEAT_KEYS: SeatKey[] = [
  "crewLeader",
  "driver",
  ...Array.from({ length: CREW_SEATS }, (_, i) => i),
];

export const seatLabel = (key: SeatKey) =>
  key === "crewLeader" ? "Crew Leader" : key === "driver" ? "Driver" : `Crew ${key + 1}`;

export const getSeat = (seats: CrewSeatsDraft, key: SeatKey) =>
  typeof key === "number" ? seats.crewMembers[key] : seats[key];

export function setSeat(seats: CrewSeatsDraft, key: SeatKey, seat: SeatDraft): CrewSeatsDraft {
  if (typeof key === "number") {
    const crewMembers = [...seats.crewMembers];
    crewMembers[key] = seat;
    return { ...seats, crewMembers };
  }
  return { ...seats, [key]: seat };
}

/** Which seat a member holds on this truck, if any. */
export const seatHeldBy = (seats: CrewSeatsDraft, userId: Id<"users">) =>
  SEAT_KEYS.find((key) => getSeat(seats, key).userId === userId);

/**
 * Put a member in a seat. Someone already on the truck moves rather than
 * appearing twice, and whoever held the seat they move into takes their old
 * one (or it empties, if the seat was empty).
 */
export function placeMember(seats: CrewSeatsDraft, key: SeatKey, userId: Id<"users">): CrewSeatsDraft {
  const from = seatHeldBy(seats, userId);
  const next = setSeat(seats, key, { userId, name: "" });
  return from === undefined || from === key ? next : setSeat(next, from, getSeat(seats, key));
}

export const clearSeat = (seats: CrewSeatsDraft, key: SeatKey) => setSeat(seats, key, emptySeat());
