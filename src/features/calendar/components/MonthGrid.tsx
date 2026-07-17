import { useMemo, useRef } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { CalendarEvent } from "../lib/parseIcs";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;
const MAX_DOTS = 3;
const SWIPE_THRESHOLD_PX = 48;

interface MonthGridProps {
  /** Any date inside the displayed month */
  month: Date;
  events: CalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onMonthChange: (delta: number) => void;
}

export function MonthGrid({
  month,
  events,
  selectedDate,
  onSelectDate,
  onSelectEvent,
  onMonthChange,
}: MonthGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = format(event.start, "yyyy-MM-dd");
      const list = map.get(key);
      if (list) {
        list.push(event);
      } else {
        map.set(key, [event]);
      }
    }
    return map;
  }, [events]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-day-idx]");
    if (!cell) return;

    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      onMonthChange(e.key === "PageUp" ? -1 : 1);
      return;
    }

    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const delta = deltas[e.key];
    if (delta === undefined) return;

    e.preventDefault();
    const nextIdx = Number(cell.dataset.dayIdx) + delta;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-day-idx="${nextIdx}"] button`)
      ?.focus();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      onMonthChange(dx < 0 ? 1 : -1);
    }
  };

  return (
    <div
      ref={gridRef}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="pb-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        {days.map((day, idx) => {
          const dayEvents = eventsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
          const inMonth = isSameMonth(day, month);
          const selected = isSameDay(day, selectedDate);
          const overflow = dayEvents.length - MAX_CHIPS;

          return (
            <div
              key={day.getTime()}
              data-day-idx={idx}
              onClick={() => onSelectDate(day)}
              className={`min-h-14 border-gray-200 dark:border-gray-700 md:min-h-24 ${
                idx % 7 !== 0 ? "border-l" : ""
              } ${idx >= 7 ? "border-t" : ""} ${
                selected
                  ? "bg-purple-50 dark:bg-purple-900/20"
                  : inMonth
                    ? "bg-white dark:bg-gray-800"
                    : "bg-gray-50 dark:bg-gray-900"
              }`}
            >
              <button
                onClick={() => onSelectDate(day)}
                aria-label={`${format(day, "EEEE d MMMM yyyy")}${
                  dayEvents.length > 0
                    ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}`
                    : ""
                }`}
                aria-pressed={selected}
                className="flex w-full flex-col items-center gap-1 rounded-sm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 md:items-start"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                    isToday(day)
                      ? "bg-red-600 font-semibold text-white"
                      : selected
                        ? "font-semibold text-purple-700 dark:text-purple-300"
                        : inMonth
                          ? "text-gray-900 dark:text-gray-100"
                          : "text-muted-foreground/60"
                  }`}
                >
                  {format(day, "d")}
                </span>

                {/* Mobile: event dots */}
                {dayEvents.length > 0 && (
                  <span className="flex gap-0.5 md:hidden" aria-hidden="true">
                    {dayEvents.slice(0, MAX_DOTS).map((event) => (
                      <span
                        key={event.uid}
                        className={`h-1.5 w-1.5 rounded-full ${
                          inMonth
                            ? "bg-purple-500"
                            : "bg-purple-500/40"
                        }`}
                      />
                    ))}
                  </span>
                )}
              </button>

              {/* Desktop: event chips */}
              {dayEvents.length > 0 && (
                <div className="hidden flex-col gap-0.5 px-1 pb-1 md:flex">
                  {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                    <button
                      key={event.uid}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(event);
                      }}
                      title={event.summary}
                      className={`w-full truncate rounded px-1 py-0.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 ${
                        event.allDay
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:hover:bg-purple-900/60"
                      } ${inMonth ? "" : "opacity-50"}`}
                    >
                      {!event.allDay && (
                        <span className="font-medium">
                          {format(event.start, "HH:mm")}{" "}
                        </span>
                      )}
                      {event.summary}
                    </button>
                  ))}
                  {overflow > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDate(day);
                      }}
                      className="w-full rounded px-1 py-0.5 text-left text-xs text-muted-foreground hover:bg-accent"
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
