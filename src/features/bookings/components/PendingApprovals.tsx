import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { getRelativeTimeString } from "../../../utils/dateUtils";
import { formatUserName, formatBookingDate } from "../types";
import { RejectBookingDialog } from "./RejectBookingDialog";
import {
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

interface PendingApprovalsProps {
  title?: string;
}

export function PendingApprovals({ title = "Pending Your Approval" }: PendingApprovalsProps) {
  const pendingApprovals = useQuery(api.bookings.getPendingApprovalsForMe);
  const approveBooking = useMutation(api.bookings.approveBooking);
  const rejectBooking = useMutation(api.bookings.rejectBooking);

  const [rejectingBookingId, setRejectingBookingId] = useState<Id<"bookings"> | null>(null);
  const rejectingBooking = pendingApprovals?.find((b) => b._id === rejectingBookingId);

  const handleApprove = async (bookingId: Id<"bookings">) => {
    try {
      await approveBooking({ bookingId });
      toast.success("Booking approved");
    } catch (error) {
      console.error("Error approving booking:", error);
      toast.error("Failed to approve booking", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const handleRejectConfirm = async (reviewNotes: string | undefined) => {
    if (!rejectingBookingId) return;
    try {
      await rejectBooking({ bookingId: rejectingBookingId, reviewNotes });
      toast.success("Booking rejected");
    } catch (error) {
      console.error("Error rejecting booking:", error);
      toast.error("Failed to reject booking", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setRejectingBookingId(null);
    }
  };

  if (!pendingApprovals || pendingApprovals.length === 0) {
    return null;
  }

  return (
    <>
      <RejectBookingDialog
        open={rejectingBookingId !== null}
        onOpenChange={(open) => {
          if (!open) setRejectingBookingId(null);
        }}
        resourceName={rejectingBooking?.resource?.name}
        onConfirm={handleRejectConfirm}
      />

      <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 shadow-sm rounded overflow-hidden border-l-4 border-amber-500">
        <div className="p-3 border-b border-amber-200 dark:border-amber-800">
          <h2 className="text-lg font-medium flex items-center text-amber-900 dark:text-amber-100">
            <ClockIcon className="h-5 w-5 mr-2" />
            {title}
            <span className="ml-2 px-2 py-0.5 text-sm rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
              {pendingApprovals.length}
            </span>
          </h2>
        </div>
        <div className="p-3 space-y-3">
          {pendingApprovals.map((booking) => (
            <div
              key={booking._id}
              className="bg-white dark:bg-gray-800 rounded p-3 border border-amber-300 dark:border-amber-700"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold">{booking.resource?.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1">
                    <CalendarDaysIcon className="h-4 w-4" />
                    {formatBookingDate(booking)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Requested by{" "}
                    <span className="font-medium">{formatUserName(booking.requestedByUser)}</span>
                    <span className="text-xs ml-2 opacity-75">
                      ({getRelativeTimeString(booking.createdAt)})
                    </span>
                  </p>
                  {booking.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2">
                      &ldquo;{booking.notes}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(booking._id)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors flex items-center"
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectingBookingId(booking._id)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors flex items-center"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
