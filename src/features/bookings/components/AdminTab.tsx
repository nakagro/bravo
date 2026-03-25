import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { getRelativeTimeString } from "../../../utils/dateUtils";
import {
  formatUserName,
  formatTime,
  getStatusBadgeClasses,
  formatStatus,
  formatWeekday,
  formatMonth,
  getDayNum,
  formatShortDate,
} from "../types";
import { ResourceForm } from "./ResourceForm";
import { PendingApprovals } from "./PendingApprovals";
import { EmptyState } from "../../../components/shared/EmptyState";
import { DeleteConfirmDialog } from "../../../components/shared/DeleteConfirmDialog";
import {
  PlusIcon,
  InboxIcon,
  CalendarDaysIcon,
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
    <>
      {/* Resource Form Modal */}
      {showResourceForm && (
        <ResourceForm
          resourceId={editingResourceId}
          onClose={handleCloseResourceForm}
        />
      )}

      {/* Pending Approvals */}
      <PendingApprovals title="Pending Approvals" />

      {/* Manage Resources Section */}
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-medium flex items-center">
            <ArchiveBoxIcon className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" />
            Manage Resources
            {resources && resources.length > 0 && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-normal">
                ({resources.length})
              </span>
            )}
          </h2>
          <button
            onClick={handleAddResource}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors flex items-center"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Resource
          </button>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {!resources || resources.length === 0 ? (
            <EmptyState
              icon={<ArchiveBoxIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
              title="No resources created yet"
              actionLabel="Add Your First Resource"
              onAction={handleAddResource}
            />
          ) : (
            resources.map((resource) => (
              <div
                key={resource._id}
                className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Header row: Name + Desktop actions */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-base">{resource.name}</h4>
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

                {/* Status badges */}
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
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

                {/* Description */}
                {resource.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {resource.description}
                  </p>
                )}

                {/* Approvers */}
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  <div className="flex items-start gap-1.5">
                    <UsersIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">Approvers:</span>{" "}
                      <span className="break-words">
                        {resource.approverUsers.map((u) => formatUserName(u)).join(", ")}
                      </span>
                    </div>
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
        </div>
      </div>

      {/* Recent Bookings Section */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium flex items-center">
            <CalendarDaysIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
            Recent Bookings
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-normal">
              (Last 10)
            </span>
          </h3>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {!allBookings || allBookings.length === 0 ? (
            <EmptyState
              icon={<InboxIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
              title="No bookings have been made yet"
            />
          ) : (
            [...allBookings]
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, 10)
              .map((booking) => (
                  <div
                    key={booking._id}
                    className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Date badge */}
                      <div className="text-center min-w-[50px] bg-gray-100 dark:bg-gray-700 rounded-lg py-1.5 px-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          {formatWeekday(booking.startDate)}
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          {getDayNum(booking.startDate)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                          {formatMonth(booking.startDate)}
                        </div>
                      </div>

                      {/* Booking details */}
                      <div className="flex-1 min-w-0">
                        {/* Resource name, status, and view link */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {booking.resource?.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeClasses(booking.status)}`}
                            >
                              {formatStatus(booking.status)}
                            </span>
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

                        {/* Time info */}
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {booking.isAllDay ? (
                            <span className="font-medium">All day</span>
                          ) : booking.startTime && booking.endTime ? (
                            <span>
                              {formatTime(booking.startTime)} &ndash;{" "}
                              {formatTime(booking.endTime)}
                            </span>
                          ) : (
                            <span className="font-medium">All day</span>
                          )}
                          {booking.endDate && booking.endDate !== booking.startDate && (
                            <span className="ml-1 text-gray-500 dark:text-gray-400">
                              &rarr; {formatShortDate(booking.endDate)}
                            </span>
                          )}
                        </div>

                        {/* Requester info */}
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                          <span className="font-medium">Requested by:</span>{" "}
                          {formatUserName(booking.requestedByUser)}
                          <span className="mx-1.5">&bull;</span>
                          {getRelativeTimeString(booking.createdAt)}
                        </div>

                        {/* Notes */}
                        {booking.notes && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
                            <span className="font-medium text-gray-600 dark:text-gray-300">
                              Notes:
                            </span>
                            <span className="ml-1 text-gray-600 dark:text-gray-400">
                              {booking.notes}
                            </span>
                          </div>
                        )}

                        {/* Review info */}
                        {booking.reviewedBy && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <span className="font-medium">Reviewed by:</span>{" "}
                            {formatUserName(booking.reviewedByUser)}
                            {booking.reviewedAt && (
                              <>
                                <span className="mx-1.5">&bull;</span>
                                {getRelativeTimeString(booking.reviewedAt)}
                              </>
                            )}
                          </div>
                        )}

                        {/* Review notes */}
                        {booking.reviewNotes && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs border-l-2 border-red-400 dark:border-red-500">
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
        </div>
      </div>
    </>
  );
}
