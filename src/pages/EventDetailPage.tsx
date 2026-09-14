import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  formatShortDate,
  formatTime,
  formatUserName,
  formatWeekday,
  formatHeadcount,
  formatGuestSuffix,
  formatMonth,
  compareUserNames,
  getDayNum,
  getTodayStr,
} from "../features/events/types";
import { RsvpButtons } from "../features/events/components/RsvpButtons";
import { SlotPicker } from "../features/events/components/SlotPicker";
import { ShiftBoard } from "../features/events/components/ShiftBoard";
import { AllocateShiftsDialog } from "../features/events/components/AllocateShiftsDialog";
import { ResponsesModeDialog } from "../features/events/components/ResponsesModeDialog";
import { ConfirmAttendanceDialog } from "../features/events/components/ConfirmAttendanceDialog";
import { DeclineButton } from "../features/events/components/RsvpButtons";
import { GuestControls } from "../features/events/components/GuestControls";
import { EventForm } from "../features/events/components/EventForm";
import {
  AttendanceBadge,
  EventTypeChip,
  SetListBadge,
  TeamLeaderBadge,
} from "../features/events/components/badges";
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
  LockClosedIcon,
  LockOpenIcon,
  EllipsisVerticalIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const breakdownGroups = [
  {
    key: "attending",
    label: "Yes",
    dotClass: "bg-green-500",
    chipClass: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200",
    defaultOpen: true,
  },
  {
    key: "maybe",
    label: "Maybe",
    dotClass: "bg-yellow-500",
    chipClass: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200",
    defaultOpen: true,
  },
  {
    key: "notAttending",
    label: "No",
    dotClass: "bg-red-500",
    chipClass: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
    defaultOpen: true,
  },
  {
    key: "noResponse",
    label: "No response",
    dotClass: "bg-gray-400",
    chipClass: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
    // The longest list by far - collapsed so it doesn't swamp the page
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
  const [showResponsesDialog, setShowResponsesDialog] = useState(false);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(breakdownGroups.map((g) => [g.key, g.defaultOpen]))
  );

  const typedEventId = eventId as Id<"events"> | undefined;
  const event = useQuery(api.events.getEvent, typedEventId ? { eventId: typedEventId } : "skip");
  const attendance = useQuery(
    api.events.getEventAttendance,
    typedEventId ? { eventId: typedEventId } : "skip"
  );
  const confirmedAttendance = useQuery(
    api.events.getConfirmedAttendance,
    typedEventId ? { eventId: typedEventId } : "skip"
  );
  // Used to mark "you" in the (non-shift) attending list. Shift events carry
  // their own per-shift turnout (with its own "you" marking) in the ShiftBoard.
  const myUserId = useQuery(api.messages.getCurrentUserId);

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

  // Who may act on *this* event: Events Admin, the organiser, or a named team
  // leader. Permanent deletion stays with Events Admin (`canDelete`).
  const canManageEvents = event.canManage;
  const leaderIds = event.teamLeaderIds ?? [];
  const isCancelled = event.status === "cancelled";
  const isPast = (event.endDate ?? event.startDate) < getTodayStr();
  // Whether there's still anything to ask *you* - the zone-2 card
  const showRsvp = !isCancelled && !isPast;
  // Attendance is a record of what happened, so it only makes sense once the
  // event has begun - normally after it, but a same-day sign-off is fair too.
  const hasStarted = !isCancelled && event.startDate <= getTodayStr();
  const attendanceConfirmed = confirmedAttendance?.confirmedAt != null;
  const attendees = confirmedAttendance?.attendees ?? [];

  const handleCopyAttendees = async () => {
    // What gets typed into the public-facing system afterwards: the event, the
    // date, then one name per line.
    const lines = [...attendees].sort(compareUserNames).map(formatUserName);
    const text = [`${event.title} - ${formatShortDate(event.startDate)}`, ...lines].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(`Copied ${lines.length} ${lines.length === 1 ? "name" : "names"}`);
    } catch (error) {
      console.error("Error copying attendance list:", error);
      toast.error("Couldn't copy the list");
    }
  };
  // The organiser has set who's going; members can't opt in, only decline
  const responsesClosed = event.memberResponses === "closed";
  const onRoster = event.myRsvp === "attending";

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
  // Guests hang off the member who's bringing them, so the chips can carry a
  // "+2" without a second query.
  const guestsByMember = new Map(
    (attendance?.guestCounts ?? []).map((entry) => [entry.userId, entry.count])
  );
  const guestTotal = attendance?.guestTotal ?? 0;
  const dietary = attendance?.dietary ?? null;
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
      {typedEventId && (
        <AllocateShiftsDialog
          open={showAllocateDialog}
          onClose={() => setShowAllocateDialog(false)}
          eventId={typedEventId}
        />
      )}
      {typedEventId && (
        <ResponsesModeDialog
          open={showResponsesDialog}
          onClose={() => setShowResponsesDialog(false)}
          eventId={typedEventId}
          mode={responsesClosed ? "open" : "closed"}
          hasShifts={event.hasShifts === true}
          onNotify={() => setShowNotifyDialog(true)}
        />
      )}

      {typedEventId && (
        <ConfirmAttendanceDialog
          open={showAttendanceDialog}
          onClose={() => setShowAttendanceDialog(false)}
          eventId={typedEventId}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        {backButton}

        {/* Admin actions. Edit is the one standing button; everything else -
            including building the roster - lives behind the same overflow menu
            the admin list uses. Six buttons in a row wrapped onto two lines and
            crowded out the back link, on the page where reading the event
            matters most. */}
        {canManageEvents && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowEditForm(true)}
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
            >
              <PencilSquareIcon className="h-4 w-4 mr-1.5" />
              Edit
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                aria-label={`More options for ${event.title}`}
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {event.status === "active" ? (
                  <>
                    {/* Once the event has run, confirming who was actually there
                        is the job that's left - so it leads the menu. */}
                    {hasStarted && (
                      <>
                        <DropdownMenuItem onSelect={() => setShowAttendanceDialog(true)}>
                          <ClipboardDocumentCheckIcon className="h-4 w-4" />
                          {attendanceConfirmed ? "Amend attendance" : "Confirm attendance"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onSelect={() => setShowAllocateDialog(true)}>
                      <UsersIcon className="h-4 w-4" />
                      {event.hasShifts ? "Allocate shifts" : "Set who's going"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setShowResponsesDialog(true)}>
                      {responsesClosed ? (
                        <LockOpenIcon className="h-4 w-4" />
                      ) : (
                        <LockClosedIcon className="h-4 w-4" />
                      )}
                      {responsesClosed ? "Open responses" : "Close responses"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setShowNotifyDialog(true)}>
                      <BellAlertIcon className="h-4 w-4" />
                      Notify
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setShowCancelDialog(true)}
                      className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                    >
                      <XCircleIcon className="h-4 w-4" />
                      Cancel event
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={handleRestore}>
                      <ArrowUturnLeftIcon className="h-4 w-4" />
                      Restore
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* Irreversible, so it stays with Events Admin - running
                        one event isn't a mandate to erase its record */}
                    {event.canDelete && (
                      <DropdownMenuItem
                        onSelect={() => setShowDeleteDialog(true)}
                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Header - slim identity band. The left accent matches the list cards:
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
              {responsesClosed && <SetListBadge />}
              {/* Says out loud why this member has the organiser controls */}
              {event.iAmTeamLeader && <TeamLeaderBadge />}
              {isCancelled && (
                <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                  Cancelled
                </span>
              )}
              {isPast && !isCancelled && (
                <>
                  <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    Past event
                  </span>
                  <AttendanceBadge
                    attendedCount={attendanceConfirmed ? attendees.length : null}
                    canManage={canManageEvents}
                  />
                </>
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

      {/* Zone 2 - Your status: only ever about *you* (your availability / your
          place on the roster). Interactive while the event is still open; once
          it's past or cancelled there's nothing to ask, so this drops away and
          the read-only board below carries the turnout (it highlights "you"). */}
      {showRsvp && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-5">
          {responsesClosed ? (
            // Nothing to opt into - the organiser set the list. All that's left
            // is telling them if you can't make it after all, which stays
            // available precisely because being rostered isn't the same as
            // having agreed.
            <div className="sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div className="mb-3 sm:mb-0">
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {onRoster
                    ? "You're on for this one"
                    : event.myRsvp === "notAttending"
                      ? "You've said you can't make it"
                      : "You're not on the list for this one"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  The organiser has set who&apos;s going.
                </div>
              </div>
              {(onRoster || event.myRsvp === "notAttending") && (
                <div className="sm:w-auto w-full sm:min-w-[220px]">
                  <DeclineButton
                    eventId={event._id}
                    declined={event.myRsvp === "notAttending"}
                    size="lg"
                  />
                </div>
              )}
            </div>
          ) : event.hasShifts ? (
            <>
              <div className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                Which shifts can you do?
              </div>
              <SlotPicker eventId={event._id} myRsvp={event.myRsvp} />
            </>
          ) : (
            <div className="sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div className="mb-3 sm:mb-0">
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  Are you coming?
                </div>
              </div>
              <div className="sm:w-auto w-full sm:min-w-[320px]">
                <RsvpButtons eventId={event._id} myRsvp={event.myRsvp} size="lg" />
              </div>
            </div>
          )}
          {/* The +1 count only makes sense once you've said yes - it's an
              attribute of that answer, not a separate question. */}
          {!responsesClosed &&
            !event.hasShifts &&
            event.allowsGuests &&
            event.myRsvp === "attending" && (
              <GuestControls
                eventId={event._id}
                guestCount={event.myGuestCount}
                maxGuests={event.maxGuestsPerMember}
                collectsDietary={event.collectsDietary ?? false}
                dietaryNotes={event.myDietaryNotes}
              />
            )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        {/* Details - all the event information lives here as labelled sections */}
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
              {(event.location || event.address) &&
                detailSection(
                  "Where",
                  <span className="flex items-start gap-2">
                    <MapPinIcon className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="flex flex-col">
                      {event.location && <span>{event.location}</span>}
                      {event.address && (
                        <span
                          className={
                            event.location ? "text-gray-500 dark:text-gray-400" : undefined
                          }
                        >
                          {event.address}
                        </span>
                      )}
                    </span>
                  </span>
                )}
              {detailSection(
                "Organiser",
                <span className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  {formatUserName(event.createdByUser)}
                </span>
              )}
              {/* Team leaders are the people to find on the day - worth naming
                  to everyone, not just to the admins who appointed them. */}
              {event.teamLeaders.length > 0 &&
                detailSection(
                  event.teamLeaders.length === 1 ? "Team leader" : "Team leaders",
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {[...event.teamLeaders].sort(compareUserNames).map((leader) => (
                      <span key={leader._id} className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        {formatUserName(leader)}
                      </span>
                    ))}
                  </span>
                )}
              {/* A deadline for responses means nothing while responses are
                  closed - but the stored date is kept, ready for reopening */}
              {event.respondBy &&
                showRsvp &&
                !responsesClosed &&
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

          {/* Attendance - what actually happened, kept apart from the RSVP
              board above it. The two are allowed to disagree; that difference
              is the whole reason this exists, and it's what gets reported to
              the public-facing system and audited later. */}
          {hasStarted && (attendanceConfirmed || canManageEvents) && (
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">
                    Who attended{attendanceConfirmed ? ` (${attendees.length})` : ""}
                  </h3>
                  {attendanceConfirmed && confirmedAttendance?.confirmedAt && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Confirmed
                      {confirmedAttendance.confirmedBy
                        ? ` by ${formatUserName(confirmedAttendance.confirmedBy)}`
                        : ""}{" "}
                      on{" "}
                      {new Date(confirmedAttendance.confirmedAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                {attendanceConfirmed && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={handleCopyAttendees}
                      title="Copy the list of names"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      {copied ? (
                        <ClipboardDocumentCheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <ClipboardDocumentIcon className="h-4 w-4" />
                      )}
                      {copied ? "Copied" : "Copy names"}
                    </button>
                    {canManageEvents && (
                      <button
                        onClick={() => setShowAttendanceDialog(true)}
                        className="px-2.5 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Amend
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!attendanceConfirmed ? (
                <button
                  onClick={() => setShowAttendanceDialog(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <ClipboardDocumentCheckIcon className="h-4 w-4" />
                  Confirm attendance
                </button>
              ) : attendees.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Confirmed as nobody attending.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {[...attendees].sort(compareUserNames).map((member) => (
                    <MemberChip
                      key={member._id}
                      member={member}
                      isMe={member._id === myUserId}
                      isLeader={leaderIds.includes(member._id)}
                    />
                  ))}
                </div>
              )}

              {/* Where it deviated from the plan - managers only, same rule as
                  the response breakdown. Not a reprimand, just the difference
                  someone has to be able to see and explain. */}
              {confirmedAttendance?.deviation &&
                (confirmedAttendance.deviation.noShows.length > 0 ||
                  confirmedAttendance.deviation.unexpected.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                    {confirmedAttendance.deviation.noShows.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-600 dark:text-gray-300">
                          Expected, didn&apos;t attend:
                        </span>{" "}
                        {[...confirmedAttendance.deviation.noShows]
                          .sort(compareUserNames)
                          .map(formatUserName)
                          .join(", ")}
                      </div>
                    )}
                    {confirmedAttendance.deviation.unexpected.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-600 dark:text-gray-300">
                          Attended without responding:
                        </span>{" "}
                        {[...confirmedAttendance.deviation.unexpected]
                          .sort(compareUserNames)
                          .map(formatUserName)
                          .join(", ")}
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}

          {/* Zone 3 - the board: read-only turnout for everyone. Shift events get
              the per-shift ShiftBoard (roster + interested + coverage); simple
              events get the flat "going" list. Purely display - all input lives
              in the Your-status card above, so nothing here is a control. */}
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-3">
              {responsesClosed && !event.hasShifts
                ? "On the roster"
                : hasStarted
                  ? "Who said they'd come"
                  : "Who's coming"}
              {!event.hasShifts && attendance
                ? ` (${formatHeadcount(attendance.attending.length, guestTotal)})`
                : ""}
            </h3>
            {event.hasShifts ? (
              <>
                <ShiftBoard eventId={event._id} leaderIds={leaderIds} />
                {/* Rostered, but not against any shift - otherwise they'd
                    appear nowhere on this page */}
                {attendance && attendance.rosteredNoShift.length > 0 && (
                  <div className="mt-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-1">
                      Rostered, no shift yet
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[...attendance.rosteredNoShift].sort(compareUserNames).map((member) => (
                        <MemberChip
                          key={member._id}
                          member={member}
                          isMe={member._id === myUserId}
                          isLeader={leaderIds.includes(member._id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : !attendance ? (
              <Skeleton className="h-8 w-48 rounded" />
            ) : attendance.attending.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {responsesClosed
                  ? "Nobody on the roster yet."
                  : showRsvp
                    ? "No responses yet. Be the first to RSVP."
                    : "Nobody marked themselves as going."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {[...attendance.attending].sort(compareUserNames).map((member) => (
                  <MemberChip
                    key={member._id}
                    member={member}
                    isMe={member._id === myUserId}
                    isLeader={leaderIds.includes(member._id)}
                    guestCount={guestsByMember.get(member._id)}
                  />
                ))}
              </div>
            )}

            {/* Dietary requirements - managers only (the query returns null for
                everyone else), and only once somebody has actually filled one
                in. It sits with the list it describes, so the organiser reads
                the names and the notes in one place. */}
            {dietary && dietary.length > 0 && (
              <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-2">
                  Dietary requirements ({dietary.length})
                </div>
                <ul className="space-y-1.5">
                  {dietary.map((entry) => (
                    <li key={entry.member._id} className="text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatUserName(entry.member)}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        {" "}
                        - {entry.notes}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Responses panel - admin-only drill-down of every response state. */}
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
                // "Maybe" only exists on an open, shiftless event: a shift
                // event answers with a slot pick, and a closed one isn't asking
                .filter(({ key }) => !((event.hasShifts || responsesClosed) && key === "maybe"))
                .map(({ key, label, dotClass, chipClass }) => {
                  const members =
                    key === "attending" ? (attendance?.attending ?? []) : breakdown[key];
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
                        <span
                          className={`px-1.5 py-0.5 text-[11px] font-semibold rounded-full ${chipClass}`}
                        >
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
                            {[...members].sort(compareUserNames).map((member) => (
                              <li key={member._id}>{formatUserName(member)}</li>
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

interface ChipMember {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  /** Marked "can't make it" - struck through in red */
  declined?: boolean;
}

/**
 * Name chip for the simple (non-shift) attending list. "You" and "can't
 * make it" get their own accents so you can find yourself and spot conflicts at
 * a glance. Shift events render their own chips inside the ShiftBoard.
 */
function MemberChip({
  member,
  isMe = false,
  isLeader = false,
  guestCount,
}: {
  member: ChipMember;
  isMe?: boolean;
  isLeader?: boolean;
  /** Extra heads this member is bringing, rendered as a "+2" on the chip */
  guestCount?: number;
}) {
  if (member.declined) {
    return (
      <span
        title={`${formatUserName(member)}: can't make it`}
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
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm ${
        isMe
          ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-gray-900 dark:text-white font-medium"
          : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200"
      }`}
    >
      {formatUserName(member)}
      {guestCount ? (
        <span
          title={`Bringing ${guestCount} ${guestCount === 1 ? "guest" : "guests"}`}
          className="text-[11px] font-semibold text-blue-700 dark:text-blue-300"
        >
          {formatGuestSuffix(guestCount).trim()}
        </span>
      ) : null}
      {isLeader && <TeamLeaderBadge compact />}
      {isMe && <span className="text-[11px] text-red-700 dark:text-red-300">you</span>}
    </span>
  );
}
