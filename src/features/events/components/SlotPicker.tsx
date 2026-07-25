import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { formatSlotWhen, slotCoverageLabel, RsvpStatus } from "../types";

interface SlotPickerProps {
  eventId: Id<"events">;
  /** The caller's overall state — "notAttending" means they hit "Can't make it" */
  myRsvp: RsvpStatus | null;
}

/**
 * Zone 2 input surface for a shift event — purely about the **caller's own**
 * availability. A vertical list of shift toggles; tap one to say "I can do
 * this".
 *
 * Deliberately shows NO other members: the communal roster / interest picture
 * lives in the read-only `ShiftBoard` (Zone 3). That split is the whole point —
 * this card is what's asked of *you*, the board is what everyone can see. The
 * only names here are your own standing (the "you're rostered on" banner).
 */
export function SlotPicker({ eventId, myRsvp }: SlotPickerProps) {
  const slots = useQuery(api.events.getEventSlots, { eventId });
  const toggleSlot = useMutation(api.events.toggleSlotResponse);
  const declineEvent = useMutation(api.events.declineSlotEvent);

  const declined = myRsvp === "notAttending";

  const handleToggle = async (slotId: Id<"eventSlots">) => {
    try {
      await toggleSlot({ slotId });
    } catch (error) {
      toast.error("Couldn't update your shift", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const handleDecline = async () => {
    try {
      await declineEvent({ eventId });
    } catch (error) {
      toast.error("Couldn't update your response", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  if (slots === undefined) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No shifts have been set up for this event yet.
      </p>
    );
  }

  // Shifts the member has been officially rostered onto
  const myRostered = slots.filter((slot) => slot.mineAllocated);

  return (
    <div className="space-y-3">
      {myRostered.length > 0 &&
        (declined ? (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200 flex gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>
              <span className="font-semibold">
                You&apos;re rostered on {myRostered.map((slot) => slot.label).join(", ")} but
                marked yourself as can&apos;t make it.
              </span>{" "}
              The organiser will see this and re-roster the shift. Made a mistake? Tap
              &ldquo;Can&apos;t make it&rdquo; below to undo.
            </span>
          </div>
        ) : (
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-3 py-2 text-sm text-indigo-800 dark:text-indigo-200">
            <span className="font-semibold">You&apos;re rostered on:</span>{" "}
            {myRostered.map((slot) => slot.label).join(", ")}
          </div>
        ))}

      <div className="space-y-2.5">
        {slots.map((slot) => {
          const when = formatSlotWhen(slot);
          const underfilled = !!slot.targetCount && slot.allocatedCount < slot.targetCount;
          // Once you're rostered anywhere, the roster is what you're doing:
          // rostered shifts take the strong styling and leftover interest
          // picks demote to a muted hint so they can't be misread as "my
          // shifts". Rostered cards don't toggle — removing interest there
          // would silently erase your standing if the roster later changes.
          const cardState: "rostered" | "interested" | "offered" | "idle" = slot.mineAllocated
            ? "rostered"
            : slot.mineInterested
              ? myRostered.length > 0
                ? "offered"
                : "interested"
              : "idle";
          const cardClasses = {
            rostered:
              "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500 cursor-default",
            interested: "border-green-500 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-500",
            offered:
              "border-green-300 dark:border-green-900 hover:bg-gray-50 dark:hover:bg-gray-700/50",
            idle: "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50",
          }[cardState];
          const checkClasses = {
            rostered: "bg-indigo-600 border-indigo-600 text-white",
            interested: "bg-green-600 border-green-600 text-white",
            offered: "bg-green-600 border-green-600 text-white opacity-60",
            idle: "border-gray-300 dark:border-gray-500 text-transparent",
          }[cardState];
          return (
            <button
              key={slot._id}
              type="button"
              onClick={slot.mineAllocated ? undefined : () => handleToggle(slot._id)}
              aria-pressed={slot.mineInterested}
              aria-disabled={slot.mineAllocated}
              className={`w-full text-left rounded-xl border p-4 transition-all ${cardClasses}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${checkClasses}`}
                >
                  <CheckIcon className="h-4 w-4" />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {slot.label}
                    </span>
                    {slot.mineAllocated && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200">
                        You&apos;re rostered
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        underfilled
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {slotCoverageLabel(slot.allocatedCount, slot.targetCount)} rostered
                    </span>
                  </div>

                  {when && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{when}</div>
                  )}

                  <div
                    className={`text-xs font-medium mt-2 ${
                      cardState === "rostered"
                        ? "text-indigo-700 dark:text-indigo-300"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {
                      {
                        rostered: "You're rostered on this shift",
                        interested: "You're interested in this shift, tap to remove",
                        offered: "You're interested in this one, not rostered on it. Tap to withdraw.",
                        idle: "Tap if you're interested in this shift",
                      }[cardState]
                    }
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Can't make it — toggles a notAttending rsvp and clears interest */}
      <button
        type="button"
        onClick={handleDecline}
        aria-pressed={declined}
        className={`w-full flex items-center justify-center gap-1.5 px-4 py-3 min-h-[48px] text-sm font-semibold rounded-xl border transition-all ${
          declined
            ? "bg-red-600 text-white border-red-600 shadow-md"
            : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        }`}
      >
        <XMarkIcon className="h-5 w-5" />
        {declined ? "You can't make it (tap to undo)" : "Can't make it"}
      </button>
    </div>
  );
}
