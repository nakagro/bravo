import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
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

  // The stepper is local and instant; the write is debounced behind it. Tapping
  // + four times is one answer being composed, not four answers - without the
  // wait, each tap round-trips and the reactive query echoes the intermediate
  // values back, so the number visibly jumps around (1 2 3 2 4) under a fast
  // thumb. While a change is settling, local state owns the display.
  const SETTLE_MS = 800;
  const [count, setCount] = useState(guestCount);
  const [notes, setNotes] = useState(dietaryNotes ?? "");
  // The value waiting to be written; null means nothing is in flight and the
  // server is once again the source of truth.
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pending.current === null) setCount(guestCount);
  }, [guestCount]);

  useEffect(() => {
    setNotes(dietaryNotes ?? "");
  }, [dietaryNotes]);

  const flush = useCallback(async () => {
    const next = pending.current;
    if (next === null) return;
    try {
      await setRsvp({ eventId, status: "attending", guestCount: next });
      // Only release the display back to the server once the write that made it
      // true has landed - releasing earlier lets the pre-write value flash back.
      if (pending.current === next) pending.current = null;
    } catch (error) {
      console.error("Error saving guest count:", error);
      pending.current = null;
      setCount(guestCount);
      toast.error("Couldn't save how many you're bringing", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  }, [eventId, guestCount, setRsvp]);

  // Leaving the page mid-tap must not lose the answer.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    };
  }, [flush]);

  const step = (next: number) => {
    pending.current = next;
    setCount(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void flush();
    }, SETTLE_MS);
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
            onClick={() => step(count - 1)}
            disabled={disabled || count <= 0}
            aria-label="One fewer guest"
          >
            <Minus className="h-4 w-4" />
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
            onClick={() => step(count + 1)}
            disabled={disabled || count >= cap}
            aria-label="One more guest"
          >
            <Plus className="h-4 w-4" />
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
