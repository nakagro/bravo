import { format, isSameDay } from "date-fns";
import { CalendarDays, MapPin } from "lucide-react";
import {
  itemAccentTextClass,
  itemChipClasses,
  sourceLabel,
  type CalendarItem,
} from "../lib/calendarItems";

interface DayAgendaProps {
  date: Date;
  /** Items covering `date`, all-day first then by start time */
  items: CalendarItem[];
  onSelectItem: (item: CalendarItem) => void;
}

function timeColumn(item: CalendarItem, date: Date) {
  if (item.allDay) return <>All day</>;
  // Multi-day timed items: only show the boundary that falls on this day
  const startsToday = isSameDay(item.start, date);
  // A midnight end belongs to the day it closes (20:00–00:00 ends "today")
  const endsToday = isSameDay(new Date(item.end.getTime() - 1), date);
  return (
    <>
      {startsToday ? format(item.start, "HH:mm") : "…"}
      <span className="mt-0.5 block font-normal text-gray-500 dark:text-gray-400">
        {endsToday ? format(item.end, "HH:mm") : "…"}
      </span>
    </>
  );
}

export function DayAgenda({ date, items, onSelectItem }: DayAgendaProps) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
        {format(date, "EEEE d MMMM")}
      </h2>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center dark:border-gray-700">
          <CalendarDays className="mx-auto mb-2 h-6 w-6 text-gray-400 dark:text-gray-600" />
          <p className="text-sm text-muted-foreground">Nothing on this day</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => onSelectItem(item)}
              className="flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-left transition-colors hover:border-purple-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-purple-700"
            >
              <div
                className={`w-14 flex-shrink-0 text-xs font-medium ${itemAccentTextClass(item)}`}
              >
                {timeColumn(item, date)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
                    {item.title}
                  </span>
                  {item.source !== "caldav" && (
                    <span
                      className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${itemChipClasses(item)}`}
                    >
                      {sourceLabel(item)}
                    </span>
                  )}
                </div>
                {item.location && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{item.location}</span>
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
