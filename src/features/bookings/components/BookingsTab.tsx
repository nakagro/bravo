import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  formatTime,
  formatShortDate,
  formatBookingTime,
  getTodayStr,
  groupBySeries,
} from "../types";
import { BookingRequestForm } from "./BookingRequestForm";
import { PendingApprovals } from "./PendingApprovals";
import { DateBadge, StatusBadge, SectionHeader } from "./badges";
import { ClampedText } from "./ClampedText";
import { EmptyState } from "../../../components/shared/EmptyState";
import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Inbox, ChevronDown, Repeat } from "lucide-react";
import { errorMessage } from "@/lib/errors";

type MyBooking = FunctionReturnType<typeof api.bookings.getMyBookings>[number];

export function BookingsTab() {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const myBookings = useQuery(api.bookings.getMyBookings);
  const cancelBooking = useMutation(api.bookings.cancelBooking);
  const cancelBookingSeries = useMutation(api.bookings.cancelBookingSeries);

  const isLoading = myBookings === undefined;

  const handleCancelBooking = async (bookingId: Id<"bookings">) => {
    try {
      await cancelBooking({ bookingId });
      toast.success("Booking cancelled");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    }
  };

  const handleCancelSeries = async (seriesId: Id<"bookingSeries">) => {
    try {
      const cancelled = await cancelBookingSeries({ seriesId });
      toast.success(`${cancelled} booking${cancelled === 1 ? "" : "s"} cancelled`);
    } catch (error) {
      console.error("Error cancelling repeating booking:", error);
      toast.error("Failed to cancel bookings", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    }
  };

  const { upcomingBookings, historyBookings } = useMemo(() => {
    const today = getTodayStr();
    const upcoming: MyBooking[] = [];
    const history: MyBooking[] = [];

    for (const booking of myBookings ?? []) {
      const bookingEndDate = booking.endDate || booking.startDate;
      const isUpcoming =
        bookingEndDate >= today &&
        (booking.status === "pending" || booking.status === "approved");
      if (isUpcoming) {
        upcoming.push(booking);
      } else {
        history.push(booking);
      }
    }

    upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
    history.sort((a, b) => b.startDate.localeCompare(a.startDate));
    return { upcomingBookings: upcoming, historyBookings: history };
  }, [myBookings]);

  const renderBooking = (booking: MyBooking, allowCancel: boolean) => (
    <div
      key={booking._id}
      className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4"
    >
      <div className="flex items-start gap-3">
        <DateBadge dateStr={booking.startDate} />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-foreground">{booking.resource?.name}</span>
            <StatusBadge status={booking.status} />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {booking.isAllDay || !booking.startTime || !booking.endTime
                ? "All day"
                : `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`}
            </span>
            {booking.endDate && booking.endDate !== booking.startDate && (
              <span>&rarr; {formatShortDate(booking.endDate)}</span>
            )}
          </div>

          {booking.notes && (
            <ClampedText text={booking.notes} className="text-sm text-foreground/80" />
          )}
          {booking.reviewNotes && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Review: {booking.reviewNotes}
            </p>
          )}
        </div>

        {allowCancel && (booking.status === "pending" || booking.status === "approved") && (
          <ConfirmDialog
            tone="destructive"
            title="Cancel Booking"
            description={`Are you sure you want to cancel your booking for "${booking.resource?.name}"?`}
            confirmLabel="Cancel Booking"
            onConfirm={() => handleCancelBooking(booking._id)}
            trigger={
              <button className="shrink-0 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                Cancel
              </button>
            }
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-20 sm:pb-0">
      {/* Booking Request Form Modal */}
      {showRequestForm && (
        <BookingRequestForm onClose={() => setShowRequestForm(false)} />
      )}

      {/* Pending Approvals */}
      <PendingApprovals title="Pending Your Approval" />

      {/* Request New Booking Button - inline on desktop only */}
      <button
        onClick={() => setShowRequestForm(true)}
        className="hidden sm:flex w-full p-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors items-center justify-center gap-2 shadow-sm"
      >
        <Plus className="h-5 w-5" />
        Request a Booking
      </button>

      {/* Floating action button - mobile, always in thumb reach */}
      <button
        onClick={() => setShowRequestForm(true)}
        className="sm:hidden fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 h-14 pl-4 pr-5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium rounded-full shadow-lg flex items-center gap-2"
      >
        <Plus className="h-6 w-6" />
        Book
      </button>

      {/* Upcoming bookings */}
      <section className="space-y-3" aria-label="Upcoming bookings">
        <SectionHeader title="Upcoming" count={isLoading ? undefined : upcomingBookings.length} />
        {isLoading ? (
          <BookingListSkeleton />
        ) : upcomingBookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border">
            <EmptyState
              icon={<Inbox />}
              title="You have no upcoming bookings"
              description="Need a vehicle, room or equipment? Request a booking and an approver will confirm it."
              actionLabel="Request a Booking"
              onAction={() => setShowRequestForm(true)}
            />
          </div>
        ) : (
          groupBySeries(upcomingBookings).map((group) =>
            group.kind === "single" ? (
              renderBooking(group.booking, true)
            ) : (
              <SeriesBookingCard
                key={group.seriesId}
                bookings={group.bookings}
                onCancelDate={handleCancelBooking}
                onCancelAll={() => handleCancelSeries(group.seriesId as Id<"bookingSeries">)}
              />
            )
          )
        )}
      </section>

      {/* Past & inactive bookings */}
      {!isLoading && historyBookings.length > 0 && (
        <section className="space-y-3" aria-label="Past and inactive bookings">
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            aria-expanded={showHistory}
            className="flex w-full items-center gap-2 text-left min-h-[44px]"
          >
            <span className="text-sm font-semibold text-foreground">Past & inactive</span>
            <span className="text-xs text-muted-foreground">{historyBookings.length}</span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${showHistory ? "rotate-180" : ""}`}
            />
          </button>
          {showHistory && historyBookings.map((booking) => renderBooking(booking, false))}
        </section>
      )}
    </div>
  );
}

/**
 * The upcoming dates of one repeating booking, as a single card. The dates
 * fold away so a weekly booking doesn't fill the page, and each can still be
 * cancelled on its own for the one week it isn't needed.
 */
function SeriesBookingCard({
  bookings,
  onCancelDate,
  onCancelAll,
}: {
  bookings: MyBooking[];
  onCancelDate: (bookingId: Id<"bookings">) => void;
  onCancelAll: () => void;
}) {
  const [showDates, setShowDates] = useState(false);
  const first = bookings[0];
  const last = bookings[bookings.length - 1];
  // Any date still awaiting approval makes the series read as pending
  const status = bookings.some((b) => b.status === "pending") ? "pending" : "approved";

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex items-start gap-3">
        <DateBadge dateStr={first.startDate} />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-foreground">{first.resource?.name}</span>
            <StatusBadge status={status} />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
              {first.series?.description ?? "Repeating"}
            </span>
            <span>{formatBookingTime(first)}</span>
            <span>until {formatShortDate(last.startDate)}</span>
          </div>

          {first.notes && <ClampedText text={first.notes} className="text-sm text-foreground/80" />}

          <button
            onClick={() => setShowDates((prev) => !prev)}
            aria-expanded={showDates}
            className="flex items-center gap-1 min-h-[44px] text-sm font-medium text-foreground/80"
          >
            {bookings.length} upcoming dates
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showDates ? "rotate-180" : ""}`}
            />
          </button>

          {showDates && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {bookings.map((booking) => (
                <li key={booking._id} className="flex items-center gap-2 pl-3">
                  <span className="flex-1 text-sm text-foreground">
                    {formatShortDate(booking.startDate)}
                  </span>
                  <StatusBadge status={booking.status} />
                  <ConfirmDialog
                    tone="destructive"
                    title="Cancel this date"
                    description={`Cancel "${booking.resource?.name}" on ${formatShortDate(booking.startDate)}? The other dates stay booked.`}
                    confirmLabel="Cancel Date"
                    onConfirm={() => onCancelDate(booking._id)}
                    trigger={
                      <button className="shrink-0 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        Cancel
                      </button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <ConfirmDialog
          tone="destructive"
          title="Cancel Repeating Booking"
          description={`Cancel all ${bookings.length} upcoming dates of "${first.resource?.name}"?`}
          confirmLabel="Cancel All"
          onConfirm={onCancelAll}
          trigger={
            <button className="shrink-0 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              Cancel all
            </button>
          }
        />
      </div>
    </div>
  );
}

function BookingListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
