import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { RsvpStatus } from "../types";
import { Check, Clock, CircleHelp, X } from "lucide-react";
import { errorMessage } from "@/lib/errors";

interface RsvpButtonsProps {
  eventId: Id<"events">;
  myRsvp: RsvpStatus | null;
  disabled?: boolean;
  /** "lg" for the detail-page RSVP bar */
  size?: "md" | "lg";
}

const options: Array<{
  status: RsvpStatus;
  label: string;
  icon: typeof Check;
  activeClasses: string;
}> = [
  {
    status: "attending",
    label: "Yes",
    icon: Check,
    activeClasses: "bg-green-600 text-white border-green-600",
  },
  {
    status: "maybe",
    label: "Maybe",
    icon: CircleHelp,
    activeClasses: "bg-yellow-500 text-white border-yellow-500",
  },
  {
    status: "notAttending",
    label: "No",
    icon: X,
    activeClasses: "bg-red-600 text-white border-red-600",
  },
];

/**
 * Yes / Maybe / No segmented RSVP toggle. The selected state comes straight
 * from the reactive query result, so it updates live everywhere.
 */
export function RsvpButtons({ eventId, myRsvp, disabled = false, size = "md" }: RsvpButtonsProps) {
  const setRsvp = useMutation(api.events.setRsvp);

  const handleSelect = async (status: RsvpStatus) => {
    if (status === myRsvp) return;
    try {
      await setRsvp({ eventId, status });
    } catch (error) {
      console.error("Error setting RSVP:", error);
      toast.error("Failed to save your RSVP", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    }
  };

  return (
    <div className="flex gap-2" role="group" aria-label="RSVP">
      {options.map(({ status, label, icon: Icon, activeClasses }) => {
        const isSelected = myRsvp === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            onClick={() => handleSelect(status)}
            aria-pressed={isSelected}
            className={`${
              size === "lg"
                ? "flex-1 px-4 py-3 min-h-[52px] text-base font-semibold rounded-xl"
                : "flex-1 sm:flex-initial sm:px-4 px-3 py-2 min-h-[40px] text-sm font-medium rounded-lg"
            } border transition-all flex items-center justify-center gap-1.5 ${
              isSelected
                ? `${activeClasses} shadow-md scale-[1.02]`
                : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Icon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface DeclineButtonProps {
  eventId: Id<"events">;
  declined: boolean;
  disabled?: boolean;
  size?: "md" | "lg";
}

/**
 * Standalone "can't make it" toggle, for events where opting *in* isn't on
 * offer - a closed event where the organiser set the roster. Declining is never
 * closed off: being placed on a list isn't the same as having agreed to it, and
 * the organiser needs to hear about it while there's still time to backfill.
 *
 * Uses declineSlotEvent, which clears any slot picks and toggles back to "no
 * response" on a second press.
 */
export function DeclineButton({
  eventId,
  declined,
  disabled = false,
  size = "md",
}: DeclineButtonProps) {
  const declineEvent = useMutation(api.events.declineSlotEvent);

  const handleClick = async () => {
    try {
      await declineEvent({ eventId });
    } catch (error) {
      console.error("Error declining event:", error);
      toast.error("Failed to save your response", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      aria-pressed={declined}
      className={`${
        size === "lg"
          ? "w-full px-4 py-3 min-h-[52px] text-base font-semibold rounded-xl"
          : "w-full px-3 py-2 min-h-[40px] text-sm font-medium rounded-lg"
      } border transition-all flex items-center justify-center gap-1.5 ${
        declined
          ? "bg-red-600 text-white border-red-600 shadow-md scale-[1.02]"
          : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <X className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      {declined ? "Can't make it" : "I can't make it"}
    </button>
  );
}

interface ShiftRsvpButtonsProps {
  eventId: Id<"events">;
  /** "attending" = has a slot pick/allocation, "notAttending" = declined */
  myRsvp: RsvpStatus | null;
  /** Allocated to a shift by the organiser, not just interested */
  rostered?: boolean;
  disabled?: boolean;
}

/**
 * List-card response controls for a shift event, where picking a slot is the
 * RSVP. "Pick a shift" navigates to the detail page (the slot list lives
 * there); "Can't make it" toggles the notAttending rsvp via declineSlotEvent.
 *
 * The button separates the two states members kept confusing: offering shifts
 * is an answer ("RSVP sent", green, same as an interested shift card), being
 * allocated one is a commitment ("You're rostered", indigo, matching the
 * rostered styling and wording on the detail page).
 */
export function ShiftRsvpButtons({
  eventId,
  myRsvp,
  rostered = false,
  disabled = false,
}: ShiftRsvpButtonsProps) {
  const navigate = useNavigate();
  const declineEvent = useMutation(api.events.declineSlotEvent);

  const declined = myRsvp === "notAttending";
  // A rostered member who has since declined is a conflict for the organiser to
  // resolve, not a commitment to advertise back - "can't make it" wins here.
  const onRoster = rostered && !declined;
  const offered = myRsvp === "attending" && !onRoster;

  const handleDecline = async () => {
    try {
      await declineEvent({ eventId });
    } catch (error) {
      console.error("Error declining event:", error);
      toast.error("Failed to save your response", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    }
  };

  const baseClasses =
    "flex-1 sm:flex-initial sm:px-4 px-3 py-2 min-h-[40px] text-sm font-medium rounded-lg border transition-all flex items-center justify-center gap-1.5";
  const idleClasses =
    "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700";

  return (
    <div className="flex gap-2" role="group" aria-label="Shift response">
      <button
        type="button"
        disabled={disabled}
        onClick={() => navigate(`/events/${eventId}`)}
        className={`${baseClasses} ${
          onRoster
            ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]"
            : offered
              ? "bg-green-600 text-white border-green-600 shadow-md scale-[1.02]"
              : idleClasses
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {onRoster || offered ? (
          <Check className="h-4 w-4" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
        {onRoster ? "You're rostered" : offered ? "RSVP sent" : "Pick a shift"}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={handleDecline}
        aria-pressed={declined}
        className={`${baseClasses} ${
          declined ? "bg-red-600 text-white border-red-600 shadow-md scale-[1.02]" : idleClasses
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <X className="h-4 w-4" />
        Can&apos;t make it
      </button>
    </div>
  );
}
