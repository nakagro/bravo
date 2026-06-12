import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { RsvpStatus } from "../types";
import { CheckIcon, QuestionMarkCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

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
