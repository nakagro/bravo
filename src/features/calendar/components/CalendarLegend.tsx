import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { eventTypeColors, defaultEventTypeColor } from "@/features/events/types";

interface CalendarLegendProps {
  showEvents: boolean;
  showBookings: boolean;
}

function LegendDot({ className }: { className: string }) {
  return <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${className}`} />;
}

/**
 * Colour key for the month grid — most useful on mobile where items collapse
 * to unlabelled dots. Event-type entries come from the live event-type list
 * so they stay in sync with whatever colours admins have assigned.
 */
export function CalendarLegend({ showEvents, showBookings }: CalendarLegendProps) {
  const eventTypes = useQuery(api.eventTypes.getEventTypes, showEvents ? {} : "skip");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-white px-3 py-2 text-xs text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-300">
      <div className="flex items-center gap-1.5">
        <LegendDot className="bg-purple-500" />
        Brigade calendar
      </div>

      {showEvents &&
        (eventTypes && eventTypes.length > 0 ? (
          eventTypes.map((type) => (
            <div key={type._id} className="flex items-center gap-1.5">
              <LegendDot
                className={
                  eventTypeColors[type.color]?.swatch ??
                  eventTypeColors[defaultEventTypeColor].swatch
                }
              />
              {type.name}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-1.5">
            <LegendDot className={eventTypeColors[defaultEventTypeColor].swatch} />
            Event
          </div>
        ))}

      {showBookings && (
        <>
          <div className="flex items-center gap-1.5">
            <LegendDot className="bg-green-500" />
            Booking approved
          </div>
          <div className="flex items-center gap-1.5">
            <LegendDot className="bg-yellow-500" />
            Booking pending
          </div>
        </>
      )}
    </div>
  );
}
