import { format } from "date-fns";
import { CalendarIcon } from "@heroicons/react/24/outline";
import type { CalendarEvent } from "../lib/parseIcs";

interface DayAgendaProps {
  date: Date;
  /** Events starting on `date`, sorted by start time */
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}

export function DayAgenda({ date, events, onSelectEvent }: DayAgendaProps) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
        {format(date, "EEEE d MMMM")}
      </h2>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center dark:border-gray-700">
          <CalendarIcon className="mx-auto mb-2 h-6 w-6 text-gray-400 dark:text-gray-600" />
          <p className="text-sm text-muted-foreground">No events on this day</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <button
              key={event.uid}
              onClick={() => onSelectEvent(event)}
              className="flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-left transition-colors hover:border-purple-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-purple-700"
            >
              <div className="w-14 flex-shrink-0 text-xs font-medium text-purple-600 dark:text-purple-400">
                {event.allDay ? (
                  "All day"
                ) : (
                  <>
                    {format(event.start, "HH:mm")}
                    <span className="mt-0.5 block font-normal text-gray-500 dark:text-gray-400">
                      {format(event.end, "HH:mm")}
                    </span>
                  </>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {event.summary}
                </div>
                {event.location && (
                  <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                    📍 {event.location}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
