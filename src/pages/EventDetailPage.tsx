import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  formatShortDate,
  formatSlotWhen,
  formatTime,
  formatUserName,
  formatWeekday,
  formatMonth,
  getDayNum,
  getInitials,
  getTodayStr,
} from "../features/events/types";
import { RsvpButtons } from "../features/events/components/RsvpButtons";
import { SlotPicker } from "../features/events/components/SlotPicker";
import { AllocateShiftsDialog } from "../features/events/components/AllocateShiftsDialog";
import { EventForm } from "../features/events/components/EventForm";
import { EventTypeChip } from "../features/events/components/badges";
import { CancelEventDialog } from "../features/events/components/CancelEventDialog";
import { NotifyMembersDialog } from "../features/events/components/NotifyMembersDialog";
import { DeleteEventDialog } from "../features/events/components/DeleteEventDialog";
import { downloadEventIcs } from "../features/events/ics";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  MapPinIcon,
  PencilSquareIcon,
  XCircleIcon,
  ArrowUturnLeftIcon,
  BellAlertIcon,
  ClockIcon,
  UserIcon,
  UsersIcon,
  TrashIcon,
  ChevronDownIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// The admin-only breakdown groups (the attending "Going" list lives in its own
// member-visible "Who's coming" card, so it's deliberately not repeated here).
const breakdownGroups = [
  {
    key: "maybe",
    label: "Maybe",
    dotClass: "bg-yellow-500",
    chipClass: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200",
    defaultOpen: true,
  },
  {
    key: "notAttending",
    label: "Not going",
    dotClass: "bg-red-500",
    chipClass: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
    defaultOpen: true,
  },
  {
    key: "noResponse",
    label: "No response",
    dotClass: "bg-gray-400",
    chipClass: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
    // The longest list by far — collapsed so it doesn't swamp the page
    defaultOpen: false,
  },
] as const;

export function EventDetailPage() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  const [showEditForm, setShowEditForm] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [showAllocateDialog, setShowAllocateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(breakdownGroups.map((g) => [g.key, g.defaultOpen]))
  );

  const typedEventId = eventId as Id<"events"> | undefined;
  const event = useQuery(api.events.getEvent, typedEventId ? { eventId: typedEventId } : "skip");
  const attendance = useQuery(
    api.events.getEventAttendance,
    typedEventId ? { eventId: typedEventId } : "skip"
  );
  // Per-shift breakdown for the "Who's coming" card (shift events only)
  const slots = useQuery(
    api.events.getEventSlots,
    typedEventId && event?.hasShifts ? { eventId: typedEventId } : "skip"
  );
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const canManageEvents = moduleAccess?.eventsAdmin === true;

  const cancelEvent = useMutation(api.events.cancelEvent);
  const restoreEvent = useMutation(api.events.restoreEvent);
  const deleteEvent = useMutation(api.events.deleteEvent);

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleCancelConfirm = async (reason: string | undefined) => {
    if (!typedEventId) return;
    try {
      await cancelEvent({ eventId: typedEventId, reason });
      toast.success("Event cancelled", {
        action: {
          label: "Undo",
          onClick: () => {
            restoreEvent({ eventId: typedEventId })
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
      setShowCancelDialog(false);
    }
  };

  const handleRestore = async () => {
    if (!typedEventId) return;
    try {
      await restoreEvent({ eventId: typedEventId });
      toast.success("Event restored");
    } catch (error) {
      console.error("Error restoring event:", error);
      toast.error("Failed to restore event", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const handleDelete = async () => {
    if (!typedEventId) return;
    try {
      await deleteEvent({ eventId: typedEventId });
      setShowDeleteDialog(false);
      toast.success("Event deleted");
      navigate("/events");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const backButton = (
    <button
      onClick={() => navigate("/events")}
      className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      All events
    </button>
  );

  if (event === undefined) {
    return (
      <div className="space-y-4 max-w-5xl" data-component="EventDetailPage">
        {backButton}
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-lg lg:col-span-2" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (event === null) {
    return (
      <div className="space-y-4 max-w-5xl" data-component="EventDetailPage">
        {backButton}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Event not found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            This event may have been removed, or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  const isCancelled = event.status === "cancelled";
  const isPast = (event.endDate ?? event.startDate) < getTodayStr();
  const showRsvp = !isCancelled && !isPast;

  const dateLine =
    event.endDate && event.endDate !== event.startDate
      ? `${formatShortDate(event.startDate)} – ${formatShortDate(event.endDate)}`
      : formatShortDate(event.startDate);

  const timeLine = event.isAllDay
    ? "All day"
    : event.startTime && event.endTime
      ? `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`
      : event.startTime
        ? formatTime(event.startTime)
        : "All day";

  // The full breakdown (and its stacked bar) is admin-only; members just see
  // the attending list in the "Who's coming" card.
  const breakdown = attendance?.breakdown ?? null;
  const totalMembers = breakdown ? breakdown.totalMembers : 0;
  const repliedCount = breakdown
    ? (attendance?.attending.length ?? 0) + breakdown.maybe.length + breakdown.notAttending.length
    : 0;
  const barSegments = breakdown
    ? ([
        { count: attendance?.attending.length ?? 0, className: "bg-green-500" },
        { count: breakdown.maybe.length, className: "bg-yellow-400" },
        { count: breakdown.notAttending.length, className: "bg-red-500" },
        { count: breakdown.noResponse.length, className: "bg-gray-300 dark:bg-gray-600" },
      ] as const)
    : [];

  // Labelled sub-section used inside the Details card
  const detailSection = (label: string, content: React.ReactNode) => (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-1">
        {label}
      </h4>
      <div className="text-[15px] text-gray-800 dark:text-gray-200">{content}</div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-5xl" data-component="EventDetailPage">
      {showEditForm && typedEventId && (
        <EventForm eventId={typedEventId} onClose={() => setShowEditForm(false)} />
      )}
      <CancelEventDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        eventTitle={event.title}
        onConfirm={handleCancelConfirm}
      />
      <NotifyMembersDialog
        open={showNotifyDialog}
        onOpenChange={setShowNotifyDialog}
        eventId={typedEventId ?? null}
        eventTitle={event.title}
      />
      <DeleteEventDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        eventTitle={event.title}
        onConfirm={handleDelete}
      />
      {event.hasShifts && typedEventId && (
        <AllocateShiftsDialog
          open={showAllocateDialog}
          onClose={() => setShowAllocateDialog(false)}
          eventId={typedEventId}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        {backButton}

        {/* Admin actions */}
        {canManageEvents && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowEditForm(true)}
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
            >
              <PencilSquareIcon className="h-4 w-4 mr-1" />
              Edit
            </button>
            {event.hasShifts && event.status === "active" && (
              <button
                onClick={() => setShowAllocateDialog(true)}
                className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
              >
                <UsersIcon className="h-4 w-4 mr-1" />
                Allocate
              </button>
            )}
            {event.status === "active" ? (
              <>
                <button
                  onClick={() => setShowNotifyDialog(true)}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
                >
                  <BellAlertIcon className="h-4 w-4 mr-1" />
                  Notify
                </button>
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center"
                >
                  <XCircleIcon className="h-4 w-4 mr-1" />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleRestore}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
                >
                  <ArrowUturnLeftIcon className="h-4 w-4 mr-1" />
                  Restore
                </button>
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center"
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Header — slim identity band. The left accent matches the list cards:
          red = active upcoming event, gray = past or cancelled */}
      <div
        className={`bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden border-l-4 p-4 sm:p-5 ${
          isCancelled || isPast ? "border-gray-300 dark:border-gray-600" : "border-red-600"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`flex-shrink-0 text-center rounded-lg px-3 py-2 min-w-[60px] ${
              isCancelled
                ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                : "bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70">
              {formatWeekday(event.startDate)}
            </div>
            <div className="text-3xl font-black leading-none mt-0.5">
              {getDayNum(event.startDate)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70 mt-0.5">
              {formatMonth(event.startDate)}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <EventTypeChip
                typeInfo={event.eventTypeInfo}
                legacyType={event.eventType}
                uppercase
                className="text-[11px] font-bold"
              />
              {isCancelled && (
                <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                  Cancelled
                </span>
              )}
              {isPast && !isCancelled && (
                <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  Past event
                </span>
              )}
            </div>
            <h1
              className={`text-xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white mt-1 ${
                isCancelled ? "line-through decoration-2 opacity-70" : ""
              }`}
            >
              {event.title}
            </h1>
            {isCancelled && event.cancellationReason && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1 italic">
                Cancelled: {event.cancellationReason}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* RSVP — full-width card, consistent with the rest of the page */}
      {showRsvp &&
        (event.hasShifts ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-5">
            <div className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              Which shifts can you do?
            </div>
            <SlotPicker eventId={event._id} myRsvp={event.myRsvp} />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div className="mb-3 sm:mb-0">
              <div className="text-sm font-bold text-gray-900 dark:text-white">Are you coming?</div>
            </div>
            <div className="sm:w-auto w-full sm:min-w-[320px]">
              <RsvpButtons eventId={event._id} myRsvp={event.myRsvp} size="lg" />
            </div>
          </div>
        ))}

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        {/* Details — all the event information lives here as labelled sections */}
        <div className={`space-y-4 ${breakdown ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {detailSection(
                "When",
                <span className="flex items-center gap-2">
                  <CalendarDaysIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  {dateLine}
                  <span className="text-gray-400 dark:text-gray-500">·</span>
                  {timeLine}
                </span>
              )}
              {event.location &&
                detailSection(
                  "Where",
                  <span className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    {event.location}
                  </span>
                )}
              {detailSection(
                "Organiser",
                <span className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  {formatUserName(event.createdByUser)}
                </span>
              )}
              {event.respondBy &&
                showRsvp &&
                detailSection(
                  "Respond by",
                  <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <ClockIcon className="h-4 w-4 flex-shrink-0" />
                    {formatShortDate(event.respondBy)}
                  </span>
                )}
            </div>

            {event.description && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                {detailSection(
                  "Details",
                  <p className="leading-relaxed whitespace-pre-line">{event.description}</p>
                )}
              </div>
            )}

            {!isCancelled && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => downloadEventIcs(event)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <CalendarDaysIcon className="h-4 w-4" />
                  Add to my calendar
                </button>
              </div>
            )}
          </div>

          {/* Who's coming — avatar chips for quick scanning. Visible to all
              members (the attending list is the turnout signal). For shift
              events this is per-shift: interest while nothing is allocated,
              the official roster once allocation has started. */}
          {attendance && (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-3">
                Who&apos;s coming ({attendance.attending.length})
              </h3>
              {event.hasShifts && slots && slots.length > 0 ? (
                <ShiftTurnout slots={slots} showRsvp={showRsvp} />
              ) : attendance.attending.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {showRsvp
                    ? event.hasShifts
                      ? "No responses yet — be the first to pick a shift."
                      : "No responses yet — be the first to RSVP."
                    : "Nobody marked themselves as going."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {attendance.attending.map((member) => (
                    <MemberChip key={member._id} member={member} tone="green" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Responses panel — admin-only drill-down (Maybe / Not going / No
            response). The "Going" list isn't repeated here; it's the
            member-visible "Who's coming" card above. */}
        {breakdown && (
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">
                Responses
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {repliedCount}/{totalMembers} replied
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Stacked breakdown bar (incl. the attending segment) */}
              {totalMembers > 0 && (
                <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                  {barSegments.map(
                    ({ count, className }, i) =>
                      count > 0 && (
                        <div
                          key={i}
                          className={`${className} transition-all`}
                          style={{ width: `${(count / totalMembers) * 100}%` }}
                        />
                      )
                  )}
                </div>
              )}

              {breakdownGroups
                // Shift events have no "maybe" — picking a shift or declining
                // are the only responses, so hide the impossible group
                .filter(({ key }) => !(event.hasShifts && key === "maybe"))
                .map(({ key, label, dotClass, chipClass }) => {
                const members = breakdown[key];
                const isOpen = openGroups[key];
                return (
                  <div key={key}>
                    <button
                      onClick={() => toggleGroup(key)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center gap-2 text-left group min-h-[32px]"
                    >
                      <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                        {label}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[11px] font-semibold rounded-full ${chipClass}`}>
                        {members.length}
                      </span>
                      <ChevronDownIcon
                        className={`h-4 w-4 text-gray-400 ml-auto transition-transform group-hover:text-gray-600 dark:group-hover:text-gray-300 ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen &&
                      (members.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 pl-4 mt-1">
                          Nobody yet
                        </p>
                      ) : (
                        <ul className="text-sm text-gray-800 dark:text-gray-200 pl-4 mt-1.5 space-y-1.5">
                          {members.map((member) => (
                            <li key={member._id} className="flex items-center gap-2">
                              <span className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                                {getInitials(member)}
                              </span>
                              {formatUserName(member)}
                            </li>
                          ))}
                        </ul>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type EventSlot = FunctionReturnType<typeof api.events.getEventSlots>[number];

interface ChipMember {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  /** Rostered but marked "can't make it" */
  declined?: boolean;
}

/** Avatar name chip. Green = interest/going, indigo = official roster. */
function MemberChip({
  member,
  tone,
  muted = false,
}: {
  member: ChipMember;
  tone: "green" | "indigo";
  muted?: boolean;
}) {
  if (member.declined) {
    return (
      <span
        title={`${formatUserName(member)} — can't make it`}
        className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 line-through"
      >
        <span className="h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center">
          <XMarkIcon className="h-3.5 w-3.5" />
        </span>
        {formatUserName(member)}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-200 ${
        muted ? "opacity-75" : ""
      }`}
    >
      <span
        className={`h-6 w-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
          tone === "indigo" ? "bg-indigo-600" : "bg-green-600"
        }`}
      >
        {getInitials(member)}
      </span>
      {formatUserName(member)}
    </span>
  );
}

/**
 * Per-shift turnout for the "Who's coming" card. While nothing has been
 * allocated it shows interest per shift (who put their hand up for what);
 * once allocation starts it shows the official roster instead, with anyone
 * who offered but wasn't placed listed underneath so they don't disappear.
 */
function ShiftTurnout({ slots, showRsvp }: { slots: EventSlot[]; showRsvp: boolean }) {
  const rosterStarted = slots.some((slot) => slot.allocatedCount > 0);
  const anyInterest = slots.some((slot) => slot.interested.length > 0);

  if (!rosterStarted && !anyInterest) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {showRsvp
          ? "No responses yet — be the first to pick a shift."
          : "Nobody put their hand up for a shift."}
      </p>
    );
  }

  // Roster mode: members who offered to help but weren't placed anywhere
  const allocatedAnywhere = new Set(
    slots.flatMap((slot) => slot.allocated.map((member) => member._id))
  );
  const alsoOffered = rosterStarted
    ? [
        ...new Map(
          slots
            .flatMap((slot) => slot.interested)
            .filter((member) => !allocatedAnywhere.has(member._id))
            .map((member) => [member._id, member] as const)
        ).values(),
      ]
    : [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
        {rosterStarted
          ? "The rostered crew for each shift."
          : "Interest so far — shifts haven't been rostered yet."}
      </p>

      {slots.map((slot) => {
        const members = rosterStarted ? slot.allocated : slot.interested;
        const when = formatSlotWhen(slot);
        return (
          <div key={slot._id}>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {slot.label}
              {when && (
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  {when}
                </span>
              )}
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Nobody yet</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {members.map((member) => (
                  <MemberChip
                    key={member._id}
                    member={member}
                    tone={rosterStarted ? "indigo" : "green"}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {alsoOffered.length > 0 && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
            Also offered to help
          </div>
          <div className="flex flex-wrap gap-2">
            {alsoOffered.map((member) => (
              <MemberChip key={member._id} member={member} tone="green" muted />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
