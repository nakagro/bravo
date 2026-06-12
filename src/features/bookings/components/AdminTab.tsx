import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { getRelativeTimeString } from "../../../utils/dateUtils";
import { formatUserName, formatTime, formatShortDate } from "../types";
import { DateBadge, StatusBadge, SectionHeader } from "./badges";
import { ClampedText } from "./ClampedText";
import { ResourceForm } from "./ResourceForm";
import { PendingApprovals } from "./PendingApprovals";
import { EmptyState } from "../../../components/shared/EmptyState";
import { DeleteConfirmDialog } from "../../../components/shared/DeleteConfirmDialog";
import {
  PlusIcon,
  InboxIcon,
  ArchiveBoxIcon,
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";

export function AdminTab() {
  const navigate = useNavigate();
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<Id<"bookingResources"> | null>(null);

  const resources = useQuery(api.bookings.getBookingResources);
  const allBookings = useQuery(api.bookings.getBookings);

  const deleteResource = useMutation(api.bookings.deleteBookingResource);

  const handleAddResource = () => {
    setEditingResourceId(null);
    setShowResourceForm(true);
  };

  const handleEditResource = (resourceId: Id<"bookingResources">) => {
    setEditingResourceId(resourceId);
    setShowResourceForm(true);
  };

  const handleCloseResourceForm = () => {
    setShowResourceForm(false);
    setEditingResourceId(null);
  };

  const handleDeleteResource = async (resourceId: Id<"bookingResources">) => {
    try {
      await deleteResource({ resourceId });
      toast.success("Resource deleted successfully");
    } catch (error) {
      console.error("Error deleting resource:", error);
      toast.error("Failed to delete resource", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Resource Form Modal */}
      {showResourceForm && (
        <ResourceForm
          resourceId={editingResourceId}
          onClose={handleCloseResourceForm}
        />
      )}

      {/* Pending Approvals */}
      <PendingApprovals title="Pending Approvals" />

      {/* Manage Resources */}
      <section className="space-y-3" aria-label="Manage resources">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Resources</h3>
          {resources && resources.length > 0 && (
            <span className="text-xs text-muted-foreground">{resources.length}</span>
          )}
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
          <button
            onClick={handleAddResource}
            className="shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors flex items-center"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Resource
          </button>
        </div>

        {!resources || resources.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border">
            <EmptyState
              icon={<ArchiveBoxIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
              title="No resources created yet"
              actionLabel="Add Your First Resource"
              onAction={handleAddResource}
            />
          </div>
        ) : (
          resources.map((resource) => (
            <div
              key={resource._id}
              className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4"
            >
              {/* Header row: name + chips + desktop actions */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-foreground">{resource.name}</h4>
                    {resource.approverOnly ? (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <LockClosedIcon className="h-3 w-3" />
                        Approver Only
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center gap-1">
                        <LockOpenIcon className="h-3 w-3" />
                        Open
                      </span>
                    )}
                    {!resource.isActive && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>

                  {resource.description && (
                    <p className="text-sm text-muted-foreground">{resource.description}</p>
                  )}

                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <UsersIcon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span className="break-words">
                      <span className="font-medium">Approvers:</span>{" "}
                      {resource.approverUsers.map((u) => formatUserName(u)).join(", ")}
                    </span>
                  </div>
                </div>

                {/* Desktop action buttons */}
                <div className="hidden sm:flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEditResource(resource._id)}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
                  >
                    <PencilSquareIcon className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  <DeleteConfirmDialog
                    title="Delete Resource"
                    description={`Are you sure you want to delete "${resource.name}"? This action cannot be undone.`}
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => handleDeleteResource(resource._id)}
                    trigger={
                      <button className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center">
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Delete
                      </button>
                    }
                  />
                </div>
              </div>

              {/* Mobile action buttons - full width */}
              <div className="flex sm:hidden gap-2 mt-3">
                <button
                  onClick={() => handleEditResource(resource._id)}
                  className="flex-1 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
                >
                  <PencilSquareIcon className="h-4 w-4 mr-1" />
                  Edit
                </button>
                <DeleteConfirmDialog
                  title="Delete Resource"
                  description={`Are you sure you want to delete "${resource.name}"? This action cannot be undone.`}
                  confirmLabel="Delete"
                  destructive
                  onConfirm={() => handleDeleteResource(resource._id)}
                  trigger={
                    <button className="flex-1 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center">
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  }
                />
              </div>
            </div>
          ))
        )}
      </section>

      {/* Recent Bookings */}
      <section className="space-y-3" aria-label="Recent bookings">
        <SectionHeader title="Recent bookings" suffix="last 10" />

        {!allBookings || allBookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border">
            <EmptyState
              icon={<InboxIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
              title="No bookings have been made yet"
            />
          </div>
        ) : (
          allBookings.map((booking) => (
            <div
              key={booking._id}
              className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4"
            >
              <div className="flex items-start gap-3">
                <DateBadge dateStr={booking.startDate} />

                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Resource name, status, and view link */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {booking.resource?.name}
                      </span>
                      <StatusBadge status={booking.status} isBlocked={booking.isBlocked} />
                    </div>
                    <button
                      onClick={() =>
                        navigate(`/bookings?tab=schedule&date=${booking.startDate}`)
                      }
                      className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 flex-shrink-0"
                    >
                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">View in Schedule</span>
                      <span className="sm:hidden">View</span>
                    </button>
                  </div>

                  {/* Time + requester metadata */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      {booking.isAllDay || !booking.startTime || !booking.endTime
                        ? "All day"
                        : `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`}
                    </span>
                    {booking.endDate && booking.endDate !== booking.startDate && (
                      <span>&rarr; {formatShortDate(booking.endDate)}</span>
                    )}
                    <span>
                      Requested by {formatUserName(booking.requestedByUser)} &bull;{" "}
                      {getRelativeTimeString(booking.createdAt)}
                    </span>
                  </div>

                  {/* Notes */}
                  {booking.notes && (
                    <ClampedText text={booking.notes} className="text-sm text-foreground/80" />
                  )}

                  {/* Review info */}
                  {booking.reviewedBy && (
                    <div className="text-xs text-muted-foreground">
                      Reviewed by {formatUserName(booking.reviewedByUser)}
                      {booking.reviewedAt && (
                        <> &bull; {getRelativeTimeString(booking.reviewedAt)}</>
                      )}
                    </div>
                  )}

                  {/* Review notes */}
                  {booking.reviewNotes && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs border-l-2 border-red-400 dark:border-red-500">
                      <span className="font-medium text-red-700 dark:text-red-300">
                        Review notes:
                      </span>
                      <span className="ml-1 text-red-600 dark:text-red-400">
                        {booking.reviewNotes}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
