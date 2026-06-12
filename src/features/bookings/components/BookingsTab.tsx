import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatTime, formatShortDate, getTodayStr } from "../types";
import { BookingRequestForm } from "./BookingRequestForm";
import { PendingApprovals } from "./PendingApprovals";
import { DateBadge, StatusBadge } from "./badges";
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
      className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <DateBadge dateStr={booking.startDate} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{booking.resource?.name}</span>
              <StatusBadge status={booking.status} />
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {booking.isAllDay ? (
                "All day"
              ) : booking.startTime && booking.endTime ? (
                `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`
              ) : (
                "All day"
              )}
              {booking.endDate && booking.endDate !== booking.startDate && (
                <span className="ml-1">&rarr; {formatShortDate(booking.endDate)}</span>
              )}
            </div>
            {booking.notes && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-[200px] sm:max-w-none">
                {booking.notes}
              </div>
            )}
            {booking.reviewNotes && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                Review: {booking.reviewNotes}
              </div>
            )}
          </div>
        </div>
        {allowCancel && (booking.status === "pending" || booking.status === "approved") && (
          <DeleteConfirmDialog
            title="Cancel Booking"
            description={`Are you sure you want to cancel your booking for "${booking.resource?.name}"?`}
            confirmLabel="Cancel Booking"
            destructive
            onConfirm={() => handleCancelBooking(booking._id)}
            trigger={
              <button className="px-3 py-2.5 min-h-[44px] text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0">
                Cancel
              </button>
            }
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Booking Request Form Modal */}
      {showRequestForm && (
        <BookingRequestForm onClose={() => setShowRequestForm(false)} />
      )}

      {/* Pending Approvals */}
      <PendingApprovals title="Pending Your Approval" />

      {/* Request New Booking Button — inline on desktop only */}
      <button
        onClick={() => setShowRequestForm(true)}
        className="hidden sm:flex w-full mb-4 p-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors items-center justify-center gap-2 shadow-sm"
      >
        <PlusIcon className="h-5 w-5" />
        Request a Booking
      </button>

      {/* Floating action button — mobile, always in thumb reach */}
      <button
        onClick={() => setShowRequestForm(true)}
        className="sm:hidden fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 h-14 pl-4 pr-5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium rounded-full shadow-lg flex items-center gap-2"
      >
        <PlusIcon className="h-6 w-6" />
        Book
      </button>

      {/* Upcoming Bookings Section */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Upcoming
          </h3>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {isLoading ? (
            <BookingListSkeleton />
          ) : upcomingBookings.length === 0 ? (
            <EmptyState
              icon={<InboxIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
              title="No upcoming bookings"
              description="Need a vehicle, room or equipment? Request a booking and an approver will confirm it."
              actionLabel="Request a Booking"
              onAction={() => setShowRequestForm(true)}
            />
          ) : (
            upcomingBookings.map((booking) => renderBooking(booking, true))
          )}
        </div>
      </div>

      {/* Past & inactive bookings */}
      {!isLoading && historyBookings.length > 0 && (
        <div className="mt-4 mb-20 sm:mb-0 bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className="w-full px-3 py-2.5 min-h-[44px] flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            aria-expanded={showHistory}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Past & inactive ({historyBookings.length})
            </span>
            <ChevronDownIcon
              className={`h-5 w-5 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`}
            />
          </button>
          {showHistory && (
            <div className="divide-y divide-gray-200 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700">
              {historyBookings.map((booking) => renderBooking(booking, false))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function BookingListSkeleton() {
  return (
    <div className="p-3 space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-14 w-[50px] rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
