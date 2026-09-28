import type { Id } from "../../../../convex/_generated/dataModel";
import { MemberCombobox, type MemberOption } from "@/components/shared/MemberCombobox";
import { CREW_SEATS, type CrewSeatsDraft, type SeatDraft } from "./crewSeats";

type SeatKey = "crewLeader" | "driver" | number;

interface CrewSeatPickersProps {
  /** Members to offer, already in the order they should be listed */
  options: MemberOption[];
  seats: CrewSeatsDraft;
  onChange: (seats: CrewSeatsDraft) => void;
}

/** Crew Leader, Driver and Crew 1-3: each a member, or a typed outside name. */
export function CrewSeatPickers({ options, seats, onChange }: CrewSeatPickersProps) {
  const getSeat = (key: SeatKey) => (typeof key === "number" ? seats.crewMembers[key] : seats[key]);

  const updateSeat = (key: SeatKey, change: Partial<SeatDraft>) => {
    if (typeof key === "number") {
      const crewMembers = [...seats.crewMembers];
      crewMembers[key] = { ...crewMembers[key], ...change };
      onChange({ ...seats, crewMembers });
      return;
    }
    onChange({ ...seats, [key]: { ...seats[key], ...change } });
  };

  // Hide members already seated elsewhere on this truck from each picker.
  const optionsFor = (current: Id<"users"> | null) => {
    const taken = new Set(
      [seats.driver, seats.crewLeader, ...seats.crewMembers]
        .filter((s) => s.userId !== null && s.userId !== current)
        .map((s) => s.userId)
    );
    return options.filter((o) => !taken.has(o._id));
  };

  const renderSeat = (key: SeatKey, label: string) => {
    const seat = getSeat(key);
    return (
      <MemberCombobox
        key={label}
        label={label}
        options={optionsFor(seat.userId)}
        value={seat.userId}
        onChange={(v) => updateSeat(key, { userId: v })}
        externalName={seat.name}
        onExternalChange={(name) => updateSeat(key, { name })}
      />
    );
  };

  return (
    <>
      {renderSeat("crewLeader", "Crew Leader")}
      {renderSeat("driver", "Driver")}
      {Array.from({ length: CREW_SEATS }, (_, i) => renderSeat(i, `Crew ${i + 1}`))}
    </>
  );
}
