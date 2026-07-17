import { addDays, format, isSameDay } from "date-fns";
import { Clock, MapPin, AlignLeft, Pencil, Repeat, Trash2 } from "lucide-react";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "../lib/parseIcs";

function formatEventRange(event: CalendarEvent): string {
  if (event.allDay) {
    // All-day DTEND is exclusive; the last covered day is one before it
    const lastDay = addDays(event.end, -1);
    if (lastDay <= event.start || isSameDay(event.start, lastDay)) {
      return `${format(event.start, "EEEE d MMMM yyyy")} · All day`;
    }
    return `${format(event.start, "EEE d MMM")} – ${format(lastDay, "EEE d MMM yyyy")} · All day`;
  }
  if (isSameDay(event.start, event.end)) {
    return `${format(event.start, "EEEE d MMMM yyyy")} · ${format(event.start, "HH:mm")} – ${format(event.end, "HH:mm")}`;
  }
  return `${format(event.start, "EEE d MMM, HH:mm")} – ${format(event.end, "EEE d MMM, HH:mm")}`;
}

interface EventDetailSheetProps {
  event: CalendarEvent | null;
  onClose: () => void;
  /** Show edit/delete controls (eventsAdmin gate) */
  canWrite?: boolean;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}

export function EventDetailSheet({
  event,
  onClose,
  canWrite = false,
  onEdit,
  onDelete,
}: EventDetailSheetProps) {
  return (
    <ResponsiveModal
      open={event !== null}
      onClose={onClose}
      title={event?.summary ?? ""}
      drawerHeight="max-h-[85vh]"
    >
      {event && (
        <div className="space-y-4 pb-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600 dark:text-purple-400" />
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {formatEventRange(event)}
            </p>
          </div>

          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600 dark:text-purple-400" />
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {event.location}
              </p>
            </div>
          )}

          {event.description && (
            <div className="flex items-start gap-3">
              <AlignLeft className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600 dark:text-purple-400" />
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {event.description}
              </p>
            </div>
          )}

          {canWrite &&
            (event.recurring ? (
              <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                <Repeat className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  This is a recurring event. Edit it in a calendar app
                  connected to the brigade calendar.
                </p>
              </div>
            ) : (
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => onDelete?.(event)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
                <Button variant="outline" onClick={() => onEdit?.(event)}>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
              </div>
            ))}
        </div>
      )}
    </ResponsiveModal>
  );
}
