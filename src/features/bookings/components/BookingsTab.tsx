import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatTime, formatShortDate, getTodayStr } from "../types";
import { BookingRequestForm } from "./BookingRequestForm";
import { PendingApprovals } from "./PendingApprovals";
import { DateBadge, StatusBadge, SectionHeader } from "./badges";
import { ClampedText } from "./ClampedText";
import { EmptyState } from "../../../components/shared/EmptyState";
import { DeleteConfirmDialog } from "../../../components/shared/DeleteConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PlusIcon,
  InboxIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

type MyBooking = FunctionReturnType<typeof api.bookings.getMyBookings>[number];

export function BookingsTab() {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const myBookings = useQuery(api.bookings.getMyBookings);
  const cancelBooking = useMutation(api.bookings.cancelBooking);

  const isLoading = myBookings === undefined;

  const handleCancelBooking = async (bookingId: Id<"bookings">) => {
    try {
      await cancelBooking({ bookingId });
      toast.success("Booking cancelled");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
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
          <DeleteConfirmDialog
            title="Cancel Booking"
            description={`Are you sure you want to cancel your booking for "${booking.resource?.name}"?`}
            confirmLabel="Cancel Booking"
            destructive
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
        <PlusIcon className="h-5 w-5" />
        Request a Booking
      </button>

      {/* Floating action button - mobile, always in thumb reach */}
      <button
        onClick={() => setShowRequestForm(true)}
        className="sm:hidden fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 h-14 pl-4 pr-5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium rounded-full shadow-lg flex items-center gap-2"
      >
        <PlusIcon className="h-6 w-6" />
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
              icon={<InboxIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
              title="You have no upcoming bookings"
              description="Need a vehicle, room or equipment? Request a booking and an approver will confirm it."
              actionLabel="Request a Booking"
              onAction={() => setShowRequestForm(true)}
            />
          </div>
        ) : (
          upcomingBookings.map((booking) => renderBooking(booking, true))
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
            <ChevronDownIcon
              className={`h-4 w-4 text-muted-foreground transition-transform ${showHistory ? "rotate-180" : ""}`}
            />
          </button>
          {showHistory && historyBookings.map((booking) => renderBooking(booking, false))}
        </section>
      )}
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
