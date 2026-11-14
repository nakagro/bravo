import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatTime, formatShortDate, formatMonthYear, getTodayStr } from "../types";
import {
  DateBadge,
  EventStatusBadge,
  EventTypeChip,
  SetListBadge,
  ShiftsBadge,
} from "./badges";
import { EventForm } from "./EventForm";
import { EventTypesManager } from "./EventTypesManager";
import { CancelEventDialog } from "./CancelEventDialog";
import { NotifyMembersDialog } from "./NotifyMembersDialog";
import { RestoreEventDialog } from "./EventChangeNotice";
import { DeleteEventDialog } from "./DeleteEventDialog";
import { EmptyState } from "../../../components/shared/EmptyState";
import { EventListSkeleton } from "./UpcomingTab";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, CalendarDays, SquarePen, CircleX, Undo2, BellRing, Users, Tag, Trash2, EllipsisVertical, Search, Archive } from "lucide-react";

import { FunctionReturnType } from "convex/server";
import { errorMessage } from "@/lib/errors";

type EnrichedEvent = FunctionReturnType<typeof api.events.getUpcomingEvents>[number];

export function AdminTab() {
  const navigate = useNavigate();
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<Id<"events"> | null>(null);
  const [cancellingEvent, setCancellingEvent] = useState<EnrichedEvent | null>(null);
  const [restoringEvent, setRestoringEvent] = useState<EnrichedEvent | null>(null);
  const [notifyingEvent, setNotifyingEvent] = useState<EnrichedEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EnrichedEvent | null>(null);
  const [showTypesManager, setShowTypesManager] = useState(false);
  // Admin tab has two jobs: managing what's coming up vs. browsing the archive.
  const [archiveView, setArchiveView] = useState<"upcoming" | "past">("upcoming");
  const [pastSearch, setPastSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce the archive search so we don't re-subscribe on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(pastSearch.trim()), 250);
    return () => clearTimeout(id);
  }, [pastSearch]);

  const upcomingEvents = useQuery(api.events.getUpcomingEvents, { fromDate: getTodayStr() });

  const pastArchive = usePaginatedQuery(
    api.events.getPastEventsPaged,
    archiveView === "past"
      ? { beforeDate: getTodayStr(), search: debouncedSearch || undefined }
      : "skip",
    { initialNumItems: 20 }
  );

  const restoreEvent = useMutation(api.events.restoreEvent);
  const deleteEvent = useMutation(api.events.deleteEvent);

  // Group upcoming events into month buckets so the list stays scannable as it
  // grows. Events arrive sorted ascending, so a single pass preserves order.
  const upcomingGroups = useMemo(() => {
    if (!upcomingEvents) return [];
    const groups: { label: string; events: EnrichedEvent[] }[] = [];
    for (const event of upcomingEvents) {
      const label = formatMonthYear(event.startDate);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.events.push(event);
      else groups.push({ label, events: [event] });
    }
    return groups;
  }, [upcomingEvents]);

  // Same month bucketing for the (descending) past archive results.
  const pastGroups = useMemo(() => {
    const groups: { label: string; events: EnrichedEvent[] }[] = [];
    for (const event of pastArchive.results) {
      const label = formatMonthYear(event.startDate);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.events.push(event);
      else groups.push({ label, events: [event] });
    }
    return groups;
  }, [pastArchive.results]);

  const handleAddEvent = () => {
    setEditingEventId(null);
    setShowEventForm(true);
  };

  const handleEditEvent = (eventId: Id<"events">) => {
    setEditingEventId(eventId);
    setShowEventForm(true);
  };

  const handleCloseEventForm = () => {
    setShowEventForm(false);
    setEditingEventId(null);
  };

  const handleCancelled = (eventId: Id<"events">, notified: boolean) => {
    // Once members have been told, putting it back is a Restore, which offers
    // the "back on" notice, so the quick Undo is only for a silent cancel.
    if (notified) {
      toast.success("Event cancelled and members told");
      return;
    }
    toast.success("Event cancelled", {
      action: {
        label: "Undo",
        onClick: () => {
          restoreEvent({ eventId })
            .then(() => toast.info("Event restored"))
            .catch((error) => {
              console.error("Error restoring event:", error);
              toast.error("Failed to restore event", {
                description:
                  errorMessage(error, "An unexpected error occurred."),
              });
            });
        },
      },
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEvent) return;
    const eventId = deletingEvent._id;
    setDeletingEvent(null);
    try {
      await deleteEvent({ eventId });
      toast.success("Event deleted");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    }
  };

  const renderEvent = (event: EnrichedEvent, mode: "upcoming" | "past") => (
    <div key={event._id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start gap-3">
        <DateBadge dateStr={event.startDate} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white">{event.title}</span>
            <EventTypeChip typeInfo={event.eventTypeInfo} legacyType={event.eventType} />
            {event.hasShifts && <ShiftsBadge />}
            {event.memberResponses === "closed" && <SetListBadge />}
            <EventStatusBadge status={event.status} />
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {event.isAllDay ? (
              <span className="font-medium">All day</span>
            ) : event.startTime && event.endTime ? (
              <span>
                {formatTime(event.startTime)} &ndash; {formatTime(event.endTime)}
              </span>
            ) : event.startTime ? (
              <span>{formatTime(event.startTime)}</span>
            ) : (
              <span className="font-medium">All day</span>
            )}
            {event.endDate && event.endDate !== event.startDate && (
              <span className="ml-1">&rarr; {formatShortDate(event.endDate)}</span>
            )}
            {(event.location || event.address) && (
              <span className="ml-2">&bull; {event.location || event.address}</span>
            )}
          </div>

          <button
            onClick={() => navigate(`/events/${event._id}`)}
            className="mt-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1.5"
          >
            <Users className="h-4 w-4" />
            {event.counts.attending} going · {event.counts.maybe} maybe ·{" "}
            {event.counts.notAttending} not going
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex-shrink-0 -mr-1 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label={`Actions for ${event.title}`}
          >
            <EllipsisVertical className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {mode === "past" ? (
              // Past events are an immutable record - the only management action
              // is removing one from the archive. The row links to the detail
              // page for the full attendance/audit view.
              <DropdownMenuItem
                onSelect={() => setDeletingEvent(event)}
                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onSelect={() => handleEditEvent(event._id)}>
                  <SquarePen className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {event.status === "active" ? (
                  <>
                    <DropdownMenuItem onSelect={() => setNotifyingEvent(event)}>
                      <BellRing className="h-4 w-4" />
                      Message members
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setCancellingEvent(event)}
                      className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                    >
                      <CircleX className="h-4 w-4" />
                      Cancel
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={() => setRestoringEvent(event)}>
                      <Undo2 className="h-4 w-4" />
                      Restore
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setDeletingEvent(event)}
                      className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      {showEventForm && <EventForm eventId={editingEventId} onClose={handleCloseEventForm} />}

      <EventTypesManager open={showTypesManager} onOpenChange={setShowTypesManager} />

      <CancelEventDialog
        open={cancellingEvent !== null}
        onOpenChange={(open) => {
          if (!open) setCancellingEvent(null);
        }}
        eventId={cancellingEvent?._id ?? null}
        eventTitle={cancellingEvent?.title}
        onCancelled={handleCancelled}
      />

      {restoringEvent && (
        <RestoreEventDialog
          open
          onOpenChange={(open) => !open && setRestoringEvent(null)}
          eventId={restoringEvent._id}
          eventTitle={restoringEvent.title}
        />
      )}

      <NotifyMembersDialog
        open={notifyingEvent !== null}
        onOpenChange={(open) => {
          if (!open) setNotifyingEvent(null);
        }}
        eventId={notifyingEvent?._id ?? null}
        eventTitle={notifyingEvent?.title}
      />

      <DeleteEventDialog
        open={deletingEvent !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingEvent(null);
        }}
        eventTitle={deletingEvent?.title}
        onConfirm={handleDeleteConfirm}
      />

      {/* Manage Events Section */}
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium flex items-center min-w-0">
            <CalendarDays className="h-5 w-5 mr-2 flex-shrink-0 text-red-600 dark:text-red-400" />
            <span className="truncate">Manage Events</span>
            {archiveView === "upcoming" && upcomingEvents && upcomingEvents.length > 0 && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-normal flex-shrink-0">
                ({upcomingEvents.length})
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowTypesManager(true)}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Manage event types"
              aria-label="Manage event types"
            >
              <Tag className="h-4 w-4" />
            </button>
            <button
              onClick={handleAddEvent}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors flex items-center"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Event
            </button>
          </div>
        </div>

        {/* Upcoming / Past switch - two different jobs share one admin home */}
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-900 p-0.5">
            {(["upcoming", "past"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setArchiveView(view)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  archiveView === view
                    ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
                aria-pressed={archiveView === view}
              >
                {view === "upcoming" ? "Upcoming" : "Past"}
              </button>
            ))}
          </div>
        </div>

        {archiveView === "upcoming" ? (
          upcomingEvents === undefined ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              <EventListSkeleton />
            </div>
          ) : upcomingEvents.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title="No upcoming events"
              actionLabel="Create Your First Event"
              onAction={handleAddEvent}
            />
          ) : (
            upcomingGroups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {group.label}
                  </span>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {group.events.map((event) => renderEvent(event, "upcoming"))}
                </div>
              </div>
            ))
          )
        ) : (
          <>
            {/* Archive search */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  value={pastSearch}
                  onChange={(e) => setPastSearch(e.target.value)}
                  placeholder="Search past events by title…"
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {pastArchive.isLoading && pastArchive.results.length === 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                <EventListSkeleton />
              </div>
            ) : pastArchive.results.length === 0 ? (
              <EmptyState
                icon={<Archive />}
                title={debouncedSearch ? "No matching past events" : "No past events"}
                description={
                  debouncedSearch
                    ? "Try a different search term."
                    : "Past events stay here as an attendance and audit record."
                }
              />
            ) : (
              <>
                {pastGroups.map((group) => (
                  <div key={group.label}>
                    <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {group.label}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {group.events.map((event) => renderEvent(event, "past"))}
                    </div>
                  </div>
                ))}

                {pastArchive.status === "CanLoadMore" && (
                  <div className="p-3 flex justify-center">
                    <button
                      onClick={() => pastArchive.loadMore(20)}
                      className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Load more
                    </button>
                  </div>
                )}
                {pastArchive.status === "LoadingMore" && (
                  <div className="p-3 text-center text-sm text-gray-400">Loading…</div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
