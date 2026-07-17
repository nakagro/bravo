import { Link } from "react-router-dom";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { format, startOfDay, addDays } from "date-fns";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import { selectUpcoming, type CalendarEvent } from "@/features/calendar/lib/parseIcs";

interface CalDAVCalendarProps {
  maxEvents?: number;
}

export function CalDAVCalendar({ maxEvents = 5 }: CalDAVCalendarProps) {
  const { events: allEvents, loading, error, hasLoaded, refresh } =
    useCalendarEvents();
  const events = selectUpcoming(allEvents, maxEvents);

  const formatEventDateShort = (event: CalendarEvent) => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = startOfDay(addDays(today, 1));
    const eventDate = startOfDay(event.start);

    if (eventDate.getTime() === today.getTime()) {
      return "Today";
    } else if (eventDate.getTime() === tomorrow.getTime()) {
      return "Tomorrow";
    } else {
      return format(event.start, "EEE MMM d");
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 transition-colors duration-200">
        <div className="flex items-center mb-3">
          <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Events
          </h2>
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 dark:border-purple-400"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (error && !hasLoaded) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 transition-colors duration-200">
        <div className="flex items-center mb-3">
          <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Events
          </h2>
        </div>
        <div className="text-center py-4">
          <div className="text-red-600 dark:text-red-400 mb-2 text-sm">
            Failed to load events
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {error}
          </div>
          <button
            onClick={refresh}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 transition-colors duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Events
          </h2>
        </div>
        <button
          onClick={refresh}
          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors px-2 py-1"
        >
          ↻
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-6">
          <CalendarIcon className="h-8 w-8 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No upcoming events
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <Link
              key={event.uid}
              to={`/calendar?date=${format(event.start, "yyyy-MM-dd")}`}
              className="block p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors hover:border-purple-300 dark:hover:border-purple-700"
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 w-20 text-center">
                  <div className="text-xs font-medium text-purple-600 dark:text-purple-400">
                    {formatEventDateShort(event)}
                  </div>
                  {!event.allDay && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {format(event.start, "HH:mm")}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm leading-tight mb-1 truncate">
                    {event.summary}
                  </h3>
                  {/* Duration badges removed per user request */}
                  {event.location && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      📍 {event.location}
                    </div>
                  )}
                  {event.description && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {event.description.length > 60
                        ? `${event.description.substring(0, 60)}...`
                        : event.description}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link
        to="/calendar"
        className="mt-3 block text-center text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
      >
        View calendar →
      </Link>
    </div>
  );
}
