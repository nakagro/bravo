import type { SeatView } from "./crewSeats";

interface CrewSeatRowProps {
  role: string;
  seat?: SeatView | null;
  /** What an empty seat says - "Unfilled" for deployments, "Needed" for events */
  emptyLabel?: string;
  /** Highlight the seat the viewer holds */
  isMine?: boolean;
}

/** One seat of a crewed appliance, read-only. */
export function CrewSeatRow({ role, seat, emptyLabel = "Unfilled", isMine = false }: CrewSeatRowProps) {
  const name = seat?.name;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b last:border-b-0 border-gray-100 dark:border-gray-700">
      <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 shrink-0">{role}</span>
      <span
        className={
          name
            ? `text-sm font-medium text-right truncate ${isMine ? "text-blue-700 dark:text-blue-300" : ""}`
            : "text-sm italic text-gray-400 dark:text-gray-500"
        }
      >
        {name ?? emptyLabel}
        {isMine && <span className="ml-1.5 text-xs font-normal">(you)</span>}
        {seat?.external && (
          <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">(not on BRAVO)</span>
        )}
      </span>
    </div>
  );
}
