import { addDays, format, isSameDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  AlignLeft,
  ArrowRight,
  Clock,
  MapPin,
  Package,
  Pencil,
  Repeat,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { formatCountsSummary } from "@/features/events/types";
import type { CalendarEvent } from "../lib/parseIcs";
import {
  itemAccentTextClass,
  itemChipClasses,
  sourceLabel,
  type CalendarItem,
} from "../lib/calendarItems";

function formatItemRange(item: CalendarItem): string {
  if (item.allDay) {
    // All-day ends are exclusive; the last covered day is one before
    const lastDay = addDays(item.end, -1);
    if (lastDay <= item.start || isSameDay(item.start, lastDay)) {
      return `${format(item.start, "EEEE d MMMM yyyy")} · All day`;
    }
    return `${format(item.start, "EEE d MMM")} – ${format(lastDay, "EEE d MMM yyyy")} · All day`;
  }
  if (isSameDay(item.start, item.end)) {
    return `${format(item.start, "EEEE d MMMM yyyy")} · ${format(item.start, "HH:mm")} – ${format(item.end, "HH:mm")}`;
  }
  return `${format(item.start, "EEE d MMM, HH:mm")} – ${format(item.end, "EEE d MMM, HH:mm")}`;
}

interface DetailRowProps {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  accentClass: string;
}

function DetailRow({ icon: Icon, children, accentClass }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${accentClass}`} />
      <div className="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">
        {children}
      </div>
    </div>
  );
}

interface ItemDetailSheetProps {
  item: CalendarItem | null;
  onClose: () => void;
  /** Show edit/delete controls on CalDAV items (eventsAdmin gate) */
  canWrite?: boolean;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}

export function ItemDetailSheet({
  item,
  onClose,
  canWrite = false,
  onEdit,
  onDelete,
}: ItemDetailSheetProps) {
  const navigate = useNavigate();
  const accent = item ? itemAccentTextClass(item) : "";

  return (
    <ResponsiveModal
      open={item !== null}
      onClose={onClose}
      title={item?.title ?? ""}
      drawerHeight="max-h-[85vh]"
    >
      {item && (
        <div className="space-y-4 pb-4">
          {item.source !== "caldav" && (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${itemChipClasses(item)}`}
            >
              {sourceLabel(item)}
            </span>
          )}

          <DetailRow icon={Clock} accentClass={accent}>
            {formatItemRange(item)}
          </DetailRow>

          {item.location && (
            <DetailRow icon={MapPin} accentClass={accent}>
              {item.location}
            </DetailRow>
          )}

          {item.source === "booking" && item.resourceName && (
            <DetailRow icon={Package} accentClass={accent}>
              {item.resourceName}
              {item.bookingBlocked && (
                <span className="text-gray-500 dark:text-gray-400">
                  {" "}
                  · blocked out
                </span>
              )}
            </DetailRow>
          )}

          {item.source === "booking" && item.bookedBy && (
            <DetailRow icon={User} accentClass={accent}>
              Booked by {item.bookedBy}
            </DetailRow>
          )}

          {item.source === "event" && item.eventCounts && (
            <DetailRow icon={Users} accentClass={accent}>
              {formatCountsSummary(item.eventCounts)}
            </DetailRow>
          )}

          {item.description && (
            <DetailRow icon={AlignLeft} accentClass={accent}>
              <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {item.description}
              </p>
            </DetailRow>
          )}

          {item.source === "event" && item.eventId && (
            <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700">
              <Button onClick={() => navigate(`/events/${item.eventId}`)}>
                View event & RSVP
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          )}

          {item.source === "booking" && (
            <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() =>
                  navigate(`/bookings?tab=schedule&date=${item.bookingDate}`)
                }
              >
                View in Bookings
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          )}

          {item.source === "caldav" &&
            canWrite &&
            item.ics &&
            (item.ics.recurring ? (
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
                  onClick={() => item.ics && onDelete?.(item.ics)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
                <Button
                  variant="outline"
                  onClick={() => item.ics && onEdit?.(item.ics)}
                >
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
