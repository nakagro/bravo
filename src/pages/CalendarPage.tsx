import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import type { CalendarEvent } from "@/features/calendar/lib/parseIcs";
import {
  fromBookings,
  fromBrigadeEvents,
  fromIcsEvents,
  groupItemsByDay,
  type CalendarItem,
} from "@/features/calendar/lib/calendarItems";
import { CalendarLegend } from "@/features/calendar/components/CalendarLegend";
import { MonthGrid } from "@/features/calendar/components/MonthGrid";
import { DayAgenda } from "@/features/calendar/components/DayAgenda";
import { ItemDetailSheet } from "@/features/calendar/components/ItemDetailSheet";
import { EventFormModal } from "@/features/calendar/components/EventFormModal";
import { Spinner } from "@/components/ui/spinner";

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function CalendarPage() {
  const { events, loading, error, hasLoaded, refresh } = useCalendarEvents();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState<Date>(
    () => parseDateParam(searchParams.get("date")) ?? new Date(),
  );
  const [month, setMonth] = useState<Date>(() => startOfMonth(selectedDate));
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const agendaRef = useRef<HTMLDivElement>(null);

  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const canWrite = moduleAccess?.calendarWrite === true;
  const deleteEvent = useAction(api.calendarWrite.deleteEvent);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);

  // The Events and Bookings modules overlay onto the calendar for members
  // who can access them
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const brigadeEvents = useQuery(
    api.events.getUpcomingEvents,
    moduleAccess?.events === true
      ? // Reach back a month so multi-day events spanning into the grid appear
        { fromDate: format(addDays(gridStart, -31), "yyyy-MM-dd") }
      : "skip",
  );
  const bookings = useQuery(
    api.bookings.getBookingsForDateRange,
    moduleAccess?.bookings === true
      ? {
          startDate: format(gridStart, "yyyy-MM-dd"),
          endDate: format(gridEnd, "yyyy-MM-dd"),
        }
      : "skip",
  );

  const itemsByDay = useMemo(
    () =>
      groupItemsByDay([
        ...fromIcsEvents(events),
        ...fromBrigadeEvents(brigadeEvents ?? []),
        ...fromBookings(bookings ?? []),
      ]),
    [events, brigadeEvents, bookings],
  );
  const dayItems = itemsByDay.get(format(selectedDate, "yyyy-MM-dd")) ?? [];

  const openCreateForm = () => {
    setEditingEvent(null);
    setFormOpen(true);
  };

  const openEditForm = (event: CalendarEvent) => {
    setSelectedItem(null);
    setEditingEvent(event);
    setFormOpen(true);
  };

  const requestDelete = (event: CalendarEvent) => {
    setSelectedItem(null);
    setDeleteTarget(event);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEvent({ uid: deleteTarget.uid });
      toast.success("Event deleted");
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      console.error("Failed to delete calendar event:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete the event",
      );
      // Keeps the confirm prompt up so the member can retry.
      throw err;
    }
  };

  const selectDate = (date: Date, opts?: { reveal?: boolean }) => {
    setSelectedDate(date);
    setMonth(startOfMonth(date));
    setSearchParams({ date: format(date, "yyyy-MM-dd") }, { replace: true });
    // On mobile the agenda sits below the grid; bring it into view when a
    // day is picked directly
    if (opts?.reveal && !window.matchMedia("(min-width: 1024px)").matches) {
      requestAnimationFrame(() =>
        agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    }
  };

  // Keep the selected day-of-month when browsing months (clamped to shorter
  // months by date-fns)
  const changeMonth = (delta: number) => {
    selectDate(addMonths(selectedDate, delta));
  };

  return (
    <div className="space-y-4" data-component="CalendarPage">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Calendar
        </h1>
        {canWrite && (
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Add event</span>
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2
            className="w-40 text-center text-lg font-semibold text-gray-800 dark:text-gray-200"
            aria-live="polite"
          >
            {format(month, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={() => selectDate(new Date())}
          className="px-3"
        >
          Today
        </Button>
      </div>

      <CalendarLegend
        showEvents={moduleAccess?.events === true}
        showBookings={moduleAccess?.bookings === true}
      />

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner className="text-muted-foreground" />
          <span>Loading events…</span>
        </div>
      )}

      {error && !hasLoaded && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-1 text-sm text-red-600 dark:text-red-400">
            Failed to load events
          </div>
          <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {error}
          </div>
          <Button variant="outline" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}

      {hasLoaded && (
        <div className="gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-lg bg-white p-3 shadow-sm transition-colors dark:bg-gray-800">
            <MonthGrid
              month={month}
              itemsByDay={itemsByDay}
              selectedDate={selectedDate}
              onSelectDate={(date) => selectDate(date, { reveal: true })}
              onSelectItem={setSelectedItem}
              onMonthChange={changeMonth}
            />
          </div>

          <div
            ref={agendaRef}
            className="mt-4 rounded-lg bg-white p-3 shadow-sm transition-colors dark:bg-gray-800 lg:mt-0 lg:self-start"
          >
            <DayAgenda
              date={selectedDate}
              items={dayItems}
              onSelectItem={setSelectedItem}
            />
          </div>
        </div>
      )}

      <ItemDetailSheet
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        canWrite={canWrite}
        onEdit={openEditForm}
        onDelete={requestDelete}
      />

      <EventFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        event={editingEvent}
        defaultDate={selectedDate}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this event?"
        description={<>“{deleteTarget?.summary}” will be removed from the brigade calendar for everyone, including external calendar apps.</>}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default CalendarPage;
