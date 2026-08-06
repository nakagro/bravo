import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { RsvpStatus } from "../types";
import {
  CheckIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

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
  icon: typeof CheckIcon;
  activeClasses: string;
}> = [
  {
    status: "attending",
    label: "Yes",
    icon: CheckIcon,
    activeClasses: "bg-green-600 text-white border-green-600",
  },
  {
    status: "maybe",
    label: "Maybe",
    icon: QuestionMarkCircleIcon,
    activeClasses: "bg-yellow-500 text-white border-yellow-500",
  },
  {
    status: "notAttending",
    label: "No",
    icon: XMarkIcon,
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
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
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
 * offer — a closed event where the organiser set the roster. Declining is never
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
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
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
      <XMarkIcon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      {declined ? "Can't make it" : "I can't make it"}
    </button>
  );
}

interface ShiftRsvpButtonsProps {
  eventId: Id<"events">;
  /** "attending" = has a slot pick/allocation, "notAttending" = declined */
  myRsvp: RsvpStatus | null;
  disabled?: boolean;
}

/**
 * List-card response controls for a shift event, where picking a slot is the
 * RSVP. "Pick a shift" navigates to the detail page (the slot list lives
 * there); "Can't make it" toggles the notAttending rsvp via declineSlotEvent.
 */
export function ShiftRsvpButtons({ eventId, myRsvp, disabled = false }: ShiftRsvpButtonsProps) {
  const navigate = useNavigate();
  const declineEvent = useMutation(api.events.declineSlotEvent);

  const onShift = myRsvp === "attending";
  const declined = myRsvp === "notAttending";

  const handleDecline = async () => {
    try {
      await declineEvent({ eventId });
    } catch (error) {
      console.error("Error declining event:", error);
      toast.error("Failed to save your response", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
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
          onShift ? "bg-green-600 text-white border-green-600 shadow-md scale-[1.02]" : idleClasses
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {onShift ? <CheckIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
        {onShift ? "On a shift" : "Pick a shift"}
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
        <XMarkIcon className="h-4 w-4" />
        Can&apos;t make it
      </button>
    </div>
  );
}
