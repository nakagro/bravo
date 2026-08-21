import { useNavigate } from "react-router-dom";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { formatTime, formatShortDate, formatCountsSummary, getTodayStr } from "../types";
import {
  AttendanceBadge,
  DateBadge,
  EventStatusBadge,
  EventTypeChip,
  SetListBadge,
  ShiftsBadge,
  TeamLeaderBadge,
} from "./badges";
import { DeclineButton, RsvpButtons, ShiftRsvpButtons } from "./RsvpButtons";
import { ChevronRightIcon, ClockIcon, MapPinIcon, UsersIcon } from "@heroicons/react/24/outline";

export type EnrichedEvent = FunctionReturnType<typeof api.events.getUpcomingEvents>[number];

interface EventCardProps {
  event: EnrichedEvent;
  /** Hide the RSVP buttons (past events are a read-only attendance record) */
  readOnly?: boolean;
}

export function EventCard({ event, readOnly = false }: EventCardProps) {
  const navigate = useNavigate();

  const isCancelled = event.status === "cancelled";
  const isPast = (event.endDate ?? event.startDate) < getTodayStr();
  const showRsvp = !readOnly && !isCancelled && !isPast;
  // The organiser set who's going - no opting in from the list
  const responsesClosed = event.memberResponses === "closed";
  const onRoster = event.myRsvp === "attending";

  // The red accent is a call to action, not decoration: it marks the events
  // still waiting on an answer from *you*. Once you've replied - yes, no or
  // maybe - the card goes quiet, so a long list reduces to the ones that need
  // something. An event with responses closed is never asking, so it stays
  // quiet too; declining is available there but isn't a question being put.
  const needsResponse = showRsvp && !responsesClosed && event.myRsvp === null;

  const countsSummary = formatCountsSummary(event.counts);
  const showRespondBy =
    showRsvp && !responsesClosed && !!event.respondBy && event.respondBy >= getTodayStr();

  const goToEvent = () => navigate(`/events/${event._id}`);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToEvent}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToEvent();
        }
      }}
      aria-label={`View event: ${event.title}`}
      className={`p-3 border-l-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-inset transition-colors cursor-pointer ${
        isCancelled
          ? "border-gray-300 dark:border-gray-600 opacity-70"
          : needsResponse
            ? "border-red-600"
            : "border-gray-300 dark:border-gray-600"
      }`}
    >
      <div className="flex items-start gap-3">
        <DateBadge dateStr={event.startDate} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-semibold text-gray-900 dark:text-white ${isCancelled ? "line-through" : ""}`}
            >
              {event.title}
            </span>
            <EventTypeChip typeInfo={event.eventTypeInfo} legacyType={event.eventType} />
            {event.hasShifts && <ShiftsBadge />}
            {responsesClosed && <SetListBadge />}
            {/* Only ever shown to the leader themselves - it marks the events
                they're running, not a fact about the event for everyone. */}
            {event.iAmTeamLeader && <TeamLeaderBadge />}
            {/* Past events carry an outcome, not a plan: the confirmed
                headcount, or - for whoever can fix it - that nobody has
                confirmed one yet. */}
            {isPast && !isCancelled && (
              <AttendanceBadge attendedCount={event.attendedCount} canManage={event.canManage} />
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
          </div>

          {(event.location || event.address) && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
              <MapPinIcon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {[event.location, event.address].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <UsersIcon className="h-4 w-4" />
            {countsSummary}
          </div>

          {showRespondBy && (
            <div className="mt-1 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" />
              {event.hasShifts ? "Respond" : "RSVP"} by {formatShortDate(event.respondBy!)}
            </div>
          )}

          {showRsvp && (
            // Stop clicks here from also opening the detail page
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              {responsesClosed ? (
                // Nothing to answer unless you're on the list, in which case the
                // only answer left is "can't make it"
                onRoster || event.myRsvp === "notAttending" ? (
                  <DeclineButton
                    eventId={event._id}
                    declined={event.myRsvp === "notAttending"}
                  />
                ) : null
              ) : event.hasShifts ? (
                <ShiftRsvpButtons
                  eventId={event._id}
                  myRsvp={event.myRsvp}
                  rostered={event.iAmRostered}
                />
              ) : (
                <RsvpButtons eventId={event._id} myRsvp={event.myRsvp} />
              )}
            </div>
          )}
        </div>

        <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0 self-center" />
      </div>
    </div>
  );
}
