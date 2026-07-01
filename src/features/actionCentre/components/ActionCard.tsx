import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "convex/react";
import {
  Bell,
  CalendarDays,
  Calendar,
  CalendarCheck,
  ClipboardList,
  ChevronRight,
  Check,
  X,
  HelpCircle,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import type { ActionItem } from "../types";
import { priorityColors } from "../types";

const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  availability: CalendarDays,
  bookings: Calendar,
  events: CalendarCheck,
  actions: ClipboardList,
  settings: Bell,
};

type RsvpStatus = "attending" | "notAttending" | "maybe";

interface ActionCardProps {
  action: ActionItem;
}

function rsvpEventId(action: ActionItem): Id<"events"> | undefined {
  if (action.kind !== "rsvp") return undefined;
  const meta = action.meta;
  if (!meta || typeof meta !== "object" || !("eventId" in meta)) return undefined;
  return (meta as { eventId: Id<"events"> }).eventId;
}

export function ActionCard({ action }: ActionCardProps) {
  const Icon = moduleIcons[action.moduleId] ?? Bell;
  const colorClass = priorityColors[action.priority];
  const setRsvp = useMutation(api.events.setRsvp);
  const [submitting, setSubmitting] = useState<RsvpStatus | null>(null);

  const eventId = rsvpEventId(action);

  const handleRsvp = async (status: RsvpStatus) => {
    if (!eventId) return;
    setSubmitting(status);
    try {
      await setRsvp({ eventId, status });
      toast.success(
        status === "attending"
          ? "You're attending"
          : status === "maybe"
            ? "Marked as maybe"
            : "You're not attending",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update RSVP");
    } finally {
      setSubmitting(null);
    }
  };

  const content = (
    <div className="flex items-start gap-3 p-3">
      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">
            {action.title}
          </h3>
          {action.count !== undefined && action.count > 1 && (
            <span className="text-xs font-semibold bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full px-1.5 py-0.5 border border-gray-200 dark:border-gray-600">
              {action.count}
            </span>
          )}
        </div>
        {action.description && (
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{action.description}</p>
        )}
      </div>
      {action.url && (
        <ChevronRight
          className="h-4 w-4 mt-1 flex-shrink-0 text-gray-400 dark:text-gray-500"
          aria-hidden="true"
        />
      )}
    </div>
  );

  return (
    <div className={`rounded-r-md border-l-4 ${colorClass}`}>
      {action.url ? (
        <Link to={action.url} className="block hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors rounded-r-md">
          {content}
        </Link>
      ) : (
        content
      )}

      {eventId && (
        <div className="flex gap-2 px-3 pb-3 pl-11">
          <RsvpButton
            label="Yes"
            icon={Check}
            tone="green"
            pending={submitting === "attending"}
            disabled={submitting !== null}
            onClick={() => handleRsvp("attending")}
          />
          <RsvpButton
            label="Maybe"
            icon={HelpCircle}
            tone="amber"
            pending={submitting === "maybe"}
            disabled={submitting !== null}
            onClick={() => handleRsvp("maybe")}
          />
          <RsvpButton
            label="No"
            icon={X}
            tone="red"
            pending={submitting === "notAttending"}
            disabled={submitting !== null}
            onClick={() => handleRsvp("notAttending")}
          />
        </div>
      )}
    </div>
  );
}

const RSVP_TONE_CLASSES: Record<string, string> = {
  green:
    "border-green-200 text-green-700 hover:bg-green-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-900/20",
  amber:
    "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-900/20",
  red: "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20",
};

function RsvpButton({
  label,
  icon: Icon,
  tone,
  pending,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "green" | "amber" | "red";
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border bg-white py-2 text-xs font-medium transition-colors disabled:opacity-50 dark:bg-gray-800 ${RSVP_TONE_CLASSES[tone]}`}
    >
      {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
