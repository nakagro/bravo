import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { getRelativeTimeString } from "../../../utils/dateUtils";
import {
  formatUserName,
  formatBookingDate,
  formatBookingTime,
  formatShortDate,
  groupBySeries,
} from "../types";
import { RejectBookingDialog } from "./RejectBookingDialog";
import { Clock, Check, X, CalendarDays, Repeat } from "lucide-react";

type PendingBooking = FunctionReturnType<typeof api.bookings.getPendingApprovalsForMe>[number];

// What the reject dialog is open for: one booking, or every date of a series
type RejectTarget =
  | { kind: "single"; bookingId: Id<"bookings">; resourceName?: string }
  | { kind: "series"; seriesId: Id<"bookingSeries">; resourceName?: string };

interface PendingApprovalsProps {
  title?: string;
}

export function PendingApprovals({ title = "Pending Your Approval" }: PendingApprovalsProps) {
  const pendingApprovals = useQuery(api.bookings.getPendingApprovalsForMe);
  const approveBooking = useMutation(api.bookings.approveBooking);
  const approveBookingSeries = useMutation(api.bookings.approveBookingSeries);
  const rejectBooking = useMutation(api.bookings.rejectBooking);
  const rejectBookingSeries = useMutation(api.bookings.rejectBookingSeries);
  const revertBooking = useMutation(api.bookings.revertBookingToPending);

  const [rejecting, setRejecting] = useState<RejectTarget | null>(null);

  const groups = useMemo(() => groupBySeries(pendingApprovals ?? []), [pendingApprovals]);

  // One-tap approve gets an undo instead of a confirm dialog
  const offerUndo = (message: string, bookingIds: Id<"bookings">[]) => {
    toast.success(message, {
      action: {
        label: "Undo",
        onClick: () => {
          Promise.all(bookingIds.map((bookingId) => revertBooking({ bookingId })))
            .then(() => toast.info("Approval undone, booking is pending again"))
            .catch((error) => {
              console.error("Error undoing approval:", error);
              toast.error("Failed to undo approval", {
                description:
                  error instanceof Error ? error.message : "An unexpected error occurred.",
              });
            });
        },
      },
    });
  };

  const handleApprove = async (bookingId: Id<"bookings">) => {
    try {
      await approveBooking({ bookingId });
      offerUndo("Booking approved", [bookingId]);
    } catch (error) {
      console.error("Error approving booking:", error);
      toast.error("Failed to approve booking", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const handleApproveSeries = async (seriesId: Id<"bookingSeries">) => {
    try {
      const approved = await approveBookingSeries({ seriesId });
      offerUndo(`${approved.length} bookings approved`, approved);
    } catch (error) {
      console.error("Error approving repeating booking:", error);
      toast.error("Failed to approve bookings", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const handleRejectConfirm = async (reviewNotes: string | undefined) => {
    if (!rejecting) return;
    try {
      if (rejecting.kind === "series") {
        await rejectBookingSeries({ seriesId: rejecting.seriesId, reviewNotes });
        toast.success("Bookings rejected");
      } else {
        await rejectBooking({ bookingId: rejecting.bookingId, reviewNotes });
        toast.success("Booking rejected");
      }
    } catch (error) {
      console.error("Error rejecting booking:", error);
      toast.error("Failed to reject booking", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setRejecting(null);
    }
  };

  if (groups.length === 0) {
    return null;
  }

  return (
    <>
      <RejectBookingDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
        resourceName={rejecting?.resourceName}
        onConfirm={handleRejectConfirm}
      />

      <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 shadow-sm rounded-lg overflow-hidden border-l-4 border-amber-500">
        <div className="p-3 border-b border-amber-200 dark:border-amber-800">
          <h2 className="text-lg font-medium flex items-center text-amber-900 dark:text-amber-100">
            <Clock className="h-5 w-5 mr-2" />
            {title}
            <span className="ml-2 px-2 py-0.5 text-sm rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
              {groups.length}
            </span>
          </h2>
        </div>
        <div className="p-3 space-y-3">
          {groups.map((group) =>
            group.kind === "single" ? (
              <ApprovalCard
                key={group.booking._id}
                booking={group.booking}
                when={formatBookingDate(group.booking)}
                onApprove={() => handleApprove(group.booking._id)}
                onReject={() =>
                  setRejecting({
                    kind: "single",
                    bookingId: group.booking._id,
                    resourceName: group.booking.resource?.name,
                  })
                }
              />
            ) : (
              <ApprovalCard
                key={group.seriesId}
                booking={group.bookings[0]}
                when={`${group.bookings[0].series?.description ?? "Repeating"}, ${formatBookingTime(group.bookings[0])}`}
                dates={group.bookings.map((b) => b.startDate)}
                approveLabel="Approve all"
                rejectLabel="Reject all"
                onApprove={() => handleApproveSeries(group.seriesId as Id<"bookingSeries">)}
                onReject={() =>
                  setRejecting({
                    kind: "series",
                    seriesId: group.seriesId as Id<"bookingSeries">,
                    resourceName: group.bookings[0].resource?.name,
                  })
                }
              />
            )
          )}
        </div>
      </div>
    </>
  );
}

function ApprovalCard({
  booking,
  when,
  dates,
  approveLabel = "Approve",
  rejectLabel = "Reject",
  onApprove,
  onReject,
}: {
  booking: PendingBooking;
  when: string;
  // Present for a repeating booking: every date awaiting approval
  dates?: string[];
  approveLabel?: string;
  rejectLabel?: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-300 dark:border-amber-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-semibold">{booking.resource?.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1">
            {dates ? <Repeat className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
            {when}
          </p>
          {dates && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {dates.length} dates: {dates.map(formatShortDate).join(", ")}
            </p>
          )}
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
            onClick={onApprove}
            className="flex-1 sm:flex-initial px-4 py-2.5 min-h-[44px] bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors flex items-center justify-center"
          >
            <Check className="h-4 w-4 mr-1" />
            {approveLabel}
          </button>
          <button
            onClick={onReject}
            className="flex-1 sm:flex-initial px-4 py-2.5 min-h-[44px] bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors flex items-center justify-center"
          >
            <X className="h-4 w-4 mr-1" />
            {rejectLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
