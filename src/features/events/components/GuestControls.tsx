import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface GuestControlsProps {
  eventId: Id<"events">;
  /** Server's view of what this member last said */
  guestCount: number;
  /** Absent = no limit */
  maxGuests?: number;
  /** Whether the event also asks for dietary requirements */
  collectsDietary: boolean;
  dietaryNotes: string | null;
  disabled?: boolean;
}

const HARD_CAP = 50;

/**
 * "How many are you bringing?" - the +1 count a member attaches to a Yes, and
 * the dietary note that goes with it.
 *
 * Deliberately inline rather than a dialog: it's one number, on the control the
 * member just pressed, and a dialog would make answering it feel like a second
 * task most people would skip. Only rendered once the member is attending an
 * event whose organiser turned guests on.
 *
 * The count is written straight through setRsvp (same row as the RSVP), so it
 * lives and dies with the answer it belongs to.
 */
export function GuestControls({
  eventId,
  guestCount,
  maxGuests,
  collectsDietary,
  dietaryNotes,
  disabled = false,
}: GuestControlsProps) {
  const setRsvp = useMutation(api.events.setRsvp);
  const cap = Math.min(maxGuests ?? HARD_CAP, HARD_CAP);

  // Local echo so the stepper responds instantly; the server value wins again
  // whenever it changes underneath (another device, a reset).
  const [count, setCount] = useState(guestCount);
  const [notes, setNotes] = useState(dietaryNotes ?? "");
  const pending = useRef<number | null>(null);

  useEffect(() => {
    if (pending.current === null) setCount(guestCount);
  }, [guestCount]);

  useEffect(() => {
    setNotes(dietaryNotes ?? "");
  }, [dietaryNotes]);

  const save = async (next: number) => {
    pending.current = next;
    setCount(next);
    try {
      await setRsvp({ eventId, status: "attending", guestCount: next });
    } catch (error) {
      console.error("Error saving guest count:", error);
      setCount(guestCount);
      toast.error("Couldn't save how many you're bringing", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      pending.current = null;
    }
  };

  const saveNotes = async () => {
    const trimmed = notes.trim();
    if (trimmed === (dietaryNotes ?? "").trim()) return;
    try {
      await setRsvp({ eventId, status: "attending", dietaryNotes: trimmed });
    } catch (error) {
      console.error("Error saving dietary notes:", error);
      setNotes(dietaryNotes ?? "");
      toast.error("Couldn't save your dietary requirements", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const stepClasses =
    "h-10 w-10 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Bringing anyone?
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {count === 0
              ? "Just you at the moment"
              : `You + ${count} ${count === 1 ? "guest" : "guests"}`}
            {maxGuests ? ` · up to ${maxGuests} per member` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={stepClasses}
            onClick={() => void save(count - 1)}
            disabled={disabled || count <= 0}
            aria-label="One fewer guest"
          >
            <MinusIcon className="h-4 w-4" />
          </button>
          <span
            className="w-8 text-center text-lg font-semibold text-gray-900 dark:text-white tabular-nums"
            aria-live="polite"
          >
            {count}
          </span>
          <button
            type="button"
            className={stepClasses}
            onClick={() => void save(count + 1)}
            disabled={disabled || count >= cap}
            aria-label="One more guest"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {collectsDietary && (
        <div>
          <label
            htmlFor={`dietary-${eventId}`}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Dietary requirements
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            For you and anyone you&apos;re bringing. Only the organiser sees this.
          </p>
          <textarea
            id={`dietary-${eventId}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => void saveNotes()}
            disabled={disabled}
            rows={2}
            maxLength={500}
            placeholder="e.g. one vegetarian, one gluten free"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
