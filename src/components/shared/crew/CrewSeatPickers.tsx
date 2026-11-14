import { MemberCombobox, type MemberOption } from "@/components/shared/MemberCombobox";
import {
  SEAT_KEYS,
  clearSeat,
  getSeat,
  placeMember,
  seatHeldBy,
  seatLabel,
  setSeat,
  type CrewSeatsDraft,
  type SeatKey,
} from "./crewSeats";

interface CrewSeatPickersProps {
  /** Members to offer, already in the order they should be listed */
  options: MemberOption[];
  seats: CrewSeatsDraft;
  onChange: (seats: CrewSeatsDraft) => void;
}

/**
 * Crew Leader, Driver and Crew 1-3: each a member, or a typed outside name.
 * The X empties a seat. Members already on the truck stay in every list,
 * tagged with their seat, and picking one moves them (see placeMember).
 */
export function CrewSeatPickers({ options, seats, onChange }: CrewSeatPickersProps) {
  const optionsFor = (key: SeatKey) =>
    options.map((o) => {
      const at = seatHeldBy(seats, o._id);
      if (at === undefined || at === key) return o;
      const where = `${seatLabel(at)} now`;
      return { ...o, rank: o.rank ? `${where} · ${o.rank}` : where };
    });

  return (
    <>
      {SEAT_KEYS.map((key) => {
        const seat = getSeat(seats, key);
        return (
          <MemberCombobox
            key={seatLabel(key)}
            label={seatLabel(key)}
            options={optionsFor(key)}
            value={seat.userId}
            onChange={(v) => onChange(v ? placeMember(seats, key, v) : clearSeat(seats, key))}
            externalName={seat.name}
            onExternalChange={(name) => onChange(setSeat(seats, key, { userId: null, name }))}
            showClearButton
          />
        );
      })}
    </>
  );
}
