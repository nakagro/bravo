import type { Id } from "../../../../convex/_generated/dataModel";
import type { SeatView } from "@/components/shared/crew/crewSeats";

interface ShiftCrewSeats {
  crewLeader: SeatView | null;
  driver: SeatView | null;
  crewMembers: SeatView[];
}

/**
 * One shift's crew as a single line ("Sam Lee (Driver), Alex Carter (CL), Jo
 * Park"), and whether the viewer is on it. Keeps a shift readable at a glance
 * where five seat rows per shift per appliance would swamp the page.
 */
export function shiftCrewSummary(row: ShiftCrewSeats, myId: Id<"users"> | undefined) {
  const named = (seat: SeatView, role?: string) => {
    const you = !!myId && seat.userId === myId;
    const name = you ? `${seat.name} (you)` : seat.name;
    return role ? `${name} (${role})` : name;
  };
  const parts = [
    ...(row.driver ? [named(row.driver, "Driver")] : []),
    ...(row.crewLeader ? [named(row.crewLeader, "CL")] : []),
    ...row.crewMembers.map((seat) => named(seat)),
  ];
  const mine =
    !!myId &&
    [row.crewLeader, row.driver, ...row.crewMembers].some((seat) => seat?.userId === myId);
  return { text: parts.join(", "), mine };
}
