import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatTime, getStatusBadgeClasses, formatStatus, formatWeekday, formatMonth, getDayNum, formatShortDate } from "../types";
import { BookingRequestForm } from "./BookingRequestForm";
import { PendingApprovals } from "./PendingApprovals";
import { EmptyState } from "../../../components/shared/EmptyState";
import { DeleteConfirmDialog } from "../../../components/shared/DeleteConfirmDialog";
import {
  PlusIcon,
  InboxIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

export function BookingsTab() {
  const [showRequestForm, setShowRequestForm] = useState(false);

  const myBookings = useQuery(api.bookings.getMyBookings);
  const cancelBooking = useMutation(api.bookings.cancelBooking);

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

  // Filter to only show today and future bookings
  const today = new Date().toISOString().split("T")[0];
  const upcomingBookings =
    myBookings
      ?.filter((booking) => {
        const bookingEndDate = booking.endDate || booking.startDate;
        return bookingEndDate >= today;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate)) ?? [];

  return (
    <>
      {/* Booking Request Form Modal */}
      {showRequestForm && (
        <BookingRequestForm onClose={() => setShowRequestForm(false)} />
      )}

      {/* Pending Approvals */}
      <PendingApprovals title="Pending Your Approval" />

      {/* Request New Booking Button */}
      <button
        onClick={() => setShowRequestForm(true)}
        className="w-full mb-4 p-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
      >
        <PlusIcon className="h-5 w-5" />
        Request a Booking
      </button>

      {/* Upcoming Bookings Section */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium flex items-center">
            <CalendarDaysIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
            My Upcoming Bookings
          </h3>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {upcomingBookings.length === 0 ? (
            <EmptyState
              icon={<InboxIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
              title="No upcoming bookings"
              description="Request a booking above to get started."
            />
          ) : (
            upcomingBookings.map((booking) => (
                <div
                  key={booking._id}
                  className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[50px]">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatWeekday(booking.startDate)}
                        </div>
                        <div className="text-lg font-bold">{getDayNum(booking.startDate)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatMonth(booking.startDate)}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{booking.resource?.name}</span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeClasses(booking.status)}`}
                          >
                            {formatStatus(booking.status)}
                          </span>
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
                            <span className="ml-1">
                              &rarr; {formatShortDate(booking.endDate)}
                            </span>
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
                    {booking.status === "pending" && (
                      <DeleteConfirmDialog
                        title="Cancel Booking"
                        description={`Are you sure you want to cancel your booking for "${booking.resource?.name}"?`}
                        confirmLabel="Cancel Booking"
                        destructive
                        onConfirm={() => handleCancelBooking(booking._id)}
                        trigger={
                          <button className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                            Cancel
                          </button>
                        }
                      />
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </>
  );
}
