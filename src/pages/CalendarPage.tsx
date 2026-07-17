import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCalendarEvents } from "@/features/calendar/hooks/useCalendarEvents";
import type { CalendarEvent } from "@/features/calendar/lib/parseIcs";
import { MonthGrid } from "@/features/calendar/components/MonthGrid";
import { DayAgenda } from "@/features/calendar/components/DayAgenda";
import { EventDetailSheet } from "@/features/calendar/components/EventDetailSheet";
import { EventFormModal } from "@/features/calendar/components/EventFormModal";

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
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );

  const canWrite = useQuery(api.calendarWrite.canWriteCalendar) === true;
  const deleteEvent = useAction(api.calendarWrite.deleteEvent);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreateForm = () => {
    setEditingEvent(null);
    setFormOpen(true);
  };

  const openEditForm = (event: CalendarEvent) => {
    setSelectedEvent(null);
    setEditingEvent(event);
    setFormOpen(true);
  };

  const requestDelete = (event: CalendarEvent) => {
    setSelectedEvent(null);
    setDeleteTarget(event);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
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
    } finally {
      setDeleting(false);
    }
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    setMonth(startOfMonth(date));
    setSearchParams({ date: format(date, "yyyy-MM-dd") }, { replace: true });
  };

  const changeMonth = (delta: number) => {
    const nextMonth = addMonths(month, delta);
    // Landing back on the current month re-selects today; other months
    // select the 1st so the agenda always matches the visible grid
    selectDate(
      isSameMonth(nextMonth, new Date()) ? new Date() : startOfMonth(nextMonth),
    );
  };

  const dayEvents = events.filter((event) =>
    isSameDay(event.start, selectedDate),
  );

  return (
    <div className="space-y-4" data-component="CalendarPage">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Calendar
        </h1>
        <div className="flex items-center gap-1.5">
          {canWrite && (
            <Button onClick={openCreateForm} className="mr-1">
              <Plus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Add event</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => selectDate(new Date())}
            className="px-3"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        {format(month, "MMMM yyyy")}
      </h2>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
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
              events={events}
              selectedDate={selectedDate}
              onSelectDate={selectDate}
              onSelectEvent={setSelectedEvent}
              onMonthChange={changeMonth}
            />
          </div>

          <div className="mt-4 rounded-lg bg-white p-3 shadow-sm transition-colors dark:bg-gray-800 lg:mt-0 lg:self-start">
            <DayAgenda
              date={selectedDate}
              events={dayEvents}
              onSelectEvent={setSelectedEvent}
            />
          </div>
        </div>
      )}

      <EventDetailSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.summary}” will be removed from the brigade
              calendar for everyone, including external calendar apps.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CalendarPage;
