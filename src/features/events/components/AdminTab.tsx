import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatTime, formatShortDate, formatUserName, getTodayStr } from "../types";
import { DateBadge, EventStatusBadge } from "./badges";
import { EventForm } from "./EventForm";
import { CancelEventDialog } from "./CancelEventDialog";
import { NotifyMembersDialog } from "./NotifyMembersDialog";
import { EmptyState } from "../../../components/shared/EmptyState";
import { EventListSkeleton } from "./UpcomingTab";
import {
  PlusIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  XCircleIcon,
  ArrowUturnLeftIcon,
  BellAlertIcon,
  UsersIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

import { FunctionReturnType } from "convex/server";

type EnrichedEvent = FunctionReturnType<typeof api.events.getUpcomingEvents>[number];

export function AdminTab() {
  const navigate = useNavigate();
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<Id<"events"> | null>(null);
  const [cancellingEvent, setCancellingEvent] = useState<EnrichedEvent | null>(null);
  const [notifyingEvent, setNotifyingEvent] = useState<EnrichedEvent | null>(null);
  const [showPast, setShowPast] = useState(false);

  const upcomingEvents = useQuery(api.events.getUpcomingEvents, { fromDate: getTodayStr() });
  const pastEvents = useQuery(api.events.getPastEvents, { beforeDate: getTodayStr() });

  const cancelEvent = useMutation(api.events.cancelEvent);
  const restoreEvent = useMutation(api.events.restoreEvent);

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

  const handleCancelConfirm = async (reason: string | undefined) => {
    if (!cancellingEvent) return;
    const eventId = cancellingEvent._id;
    try {
      await cancelEvent({ eventId, reason });
      // One-tap cancel gets an undo instead of a second confirm
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
                    error instanceof Error ? error.message : "An unexpected error occurred.",
                });
              });
          },
        },
      });
    } catch (error) {
      console.error("Error cancelling event:", error);
      toast.error("Failed to cancel event", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setCancellingEvent(null);
    }
  };

  const handleRestore = async (eventId: Id<"events">) => {
    try {
      await restoreEvent({ eventId });
      toast.success("Event restored");
    } catch (error) {
      console.error("Error restoring event:", error);
      toast.error("Failed to restore event", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const actionButtonClasses =
    "px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center";

  const renderEvent = (event: EnrichedEvent, allowActions: boolean) => (
    <div key={event._id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start gap-3">
        <DateBadge dateStr={event.startDate} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-white">{event.title}</span>
            {event.eventType && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 whitespace-nowrap">
                {event.eventType}
              </span>
            )}
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
            {event.location && <span className="ml-2">&bull; {event.location}</span>}
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            <span className="font-medium">Created by:</span>{" "}
            {formatUserName(event.createdByUser)}
          </div>

          <button
            onClick={() => navigate(`/events/${event._id}`)}
            className="mt-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1.5"
          >
            <UsersIcon className="h-4 w-4" />
            {event.counts.attending} going · {event.counts.maybe} maybe ·{" "}
            {event.counts.notAttending} not going
          </button>

          {allowActions && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => handleEditEvent(event._id)} className={actionButtonClasses}>
                <PencilSquareIcon className="h-4 w-4 mr-1" />
                Edit
              </button>
              {event.status === "active" ? (
                <>
                  <button
                    onClick={() => setNotifyingEvent(event)}
                    className={actionButtonClasses}
                  >
                    <BellAlertIcon className="h-4 w-4 mr-1" />
                    Notify
                  </button>
                  <button
                    onClick={() => setCancellingEvent(event)}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center"
                  >
                    <XCircleIcon className="h-4 w-4 mr-1" />
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => handleRestore(event._id)} className={actionButtonClasses}>
                  <ArrowUturnLeftIcon className="h-4 w-4 mr-1" />
                  Restore
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {showEventForm && <EventForm eventId={editingEventId} onClose={handleCloseEventForm} />}

      <CancelEventDialog
        open={cancellingEvent !== null}
        onOpenChange={(open) => {
          if (!open) setCancellingEvent(null);
        }}
        eventTitle={cancellingEvent?.title}
        onConfirm={handleCancelConfirm}
      />

      <NotifyMembersDialog
        open={notifyingEvent !== null}
        onOpenChange={(open) => {
          if (!open) setNotifyingEvent(null);
        }}
        eventId={notifyingEvent?._id ?? null}
        eventTitle={notifyingEvent?.title}
      />

      {/* Manage Events Section */}
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-medium flex items-center">
            <CalendarDaysIcon className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" />
            Manage Events
            {upcomingEvents && upcomingEvents.length > 0 && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-normal">
                ({upcomingEvents.length})
              </span>
            )}
          </h2>
          <button
            onClick={handleAddEvent}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors flex items-center"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            New Event
          </button>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {upcomingEvents === undefined ? (
            <EventListSkeleton />
          ) : upcomingEvents.length === 0 ? (
            <EmptyState
              icon={<CalendarDaysIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
              title="No upcoming events"
              actionLabel="Create Your First Event"
              onAction={handleAddEvent}
            />
          ) : (
            upcomingEvents.map((event) => renderEvent(event, true))
          )}
        </div>
      </div>

      {/* Past events (collapsed) */}
      {pastEvents && pastEvents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          <button
            onClick={() => setShowPast((prev) => !prev)}
            className="w-full px-3 py-2.5 min-h-[44px] flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            aria-expanded={showPast}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Past events ({pastEvents.length})
            </span>
            <ChevronDownIcon
              className={`h-5 w-5 text-gray-400 transition-transform ${showPast ? "rotate-180" : ""}`}
            />
          </button>
          {showPast && (
            <div className="divide-y divide-gray-200 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700">
              {pastEvents.map((event) => renderEvent(event, false))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
