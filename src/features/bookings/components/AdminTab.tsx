import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { getRelativeTimeString } from "../../../utils/dateUtils";
import { ResourceForm } from "./ResourceForm";
import {
  ClockIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  InboxIcon,
  CalendarDaysIcon,
  ArchiveBoxIcon,
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  LockClosedIcon,
  LockOpenIcon,
} from "@heroicons/react/24/outline";

interface AdminTabProps {
  isAuthenticated: boolean;
}

const AdminTab: React.FC<AdminTabProps> = ({ isAuthenticated }) => {
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<Id<"bookingResources"> | null>(null);

  const resources = useQuery(api.bookings.getBookingResources);
  const allBookings = useQuery(api.bookings.getBookings);
  const pendingApprovals = useQuery(api.bookings.getPendingApprovalsForMe);
  
  const deleteResource = useMutation(api.bookings.deleteBookingResource);
  const approveBooking = useMutation(api.bookings.approveBooking);
  const rejectBooking = useMutation(api.bookings.rejectBooking);

  // Format user display name
  const formatUserName = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user?.name) {
      return user.name;
    } else {
      return "Unknown User";
    }
  };

  // Format date for display
  const formatBookingDate = (booking: { startDate: string; endDate?: string; startTime?: string; endTime?: string; isAllDay: boolean }) => {
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
    };
    
    const formatTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    };

    let dateStr = formatDate(booking.startDate);
    if (booking.endDate && booking.endDate !== booking.startDate) {
      dateStr += ` - ${formatDate(booking.endDate)}`;
    }
    
    if (booking.isAllDay) {
      return `${dateStr} (All day)`;
    } else if (booking.startTime && booking.endTime) {
      return `${dateStr}, ${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`;
    }
    
    return dateStr;
  };

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
    if (!confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteResource({ resourceId });
      toast.success('Resource deleted successfully');
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error('Failed to delete resource', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    }
  };

  const handleApproveBooking = async (bookingId: Id<"bookings">) => {
    try {
      await approveBooking({ bookingId });
      toast.success('Booking approved');
    } catch (error) {
      console.error('Error approving booking:', error);
      toast.error('Failed to approve booking', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    }
  };

  const handleRejectBooking = async (bookingId: Id<"bookings">) => {
    const reason = prompt('Please provide a reason for rejection (optional):');
    if (reason === null) return; // User cancelled

    try {
      await rejectBooking({
        bookingId,
        reviewNotes: reason.trim() || undefined,
      });
      toast.success('Booking rejected');
    } catch (error) {
      console.error('Error rejecting booking:', error);
      toast.error('Failed to reject booking', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'approved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'cancelled':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">Please log in to access admin features.</p>
      </div>
    );
  }

  return (
    <>
      {/* Resource Form Modal */}
      {showResourceForm && (
        <ResourceForm
          resourceId={editingResourceId}
          onClose={handleCloseResourceForm}
        />
      )}

      {/* Pending Approvals Section */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 shadow-sm rounded overflow-hidden border-l-4 border-amber-500">
          <div className="p-3 border-b border-amber-200 dark:border-amber-800">
            <h2 className="text-lg font-medium flex items-center text-amber-900 dark:text-amber-100">
              <ClockIcon className="h-5 w-5 mr-2" />
              Pending Approvals
              <span className="ml-2 px-2 py-0.5 text-sm rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100">
                {pendingApprovals.length}
              </span>
            </h2>
          </div>
          <div className="p-3 space-y-3">
            {pendingApprovals.map((booking) => (
              <div key={booking._id} className="bg-white dark:bg-gray-800 rounded p-3 border border-amber-300 dark:border-amber-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold">{booking.resource?.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1">
                      <CalendarDaysIcon className="h-4 w-4" />
                      {formatBookingDate(booking)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Requested by <span className="font-medium">{formatUserName(booking.requestedByUser)}</span>
                      <span className="text-xs ml-2 opacity-75">({getRelativeTimeString(booking.createdAt)})</span>
                    </p>
                    {booking.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2">
                        "{booking.notes}"
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveBooking(booking._id)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors flex items-center"
                    >
                      <CheckIcon className="h-4 w-4 mr-1" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectBooking(booking._id)}
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
      )}

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
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <InboxIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-3">No resources created yet.</p>
              <button
                onClick={handleAddResource}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded transition-colors flex items-center"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Your First Resource
              </button>
            </div>
          ) : (
            resources.map((resource) => (
              <div key={resource._id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{resource.name}</h4>
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
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {resource.description}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                      <UsersIcon className="h-4 w-4" />
                      <span className="font-medium">Approvers:</span>{' '}
                      {resource.approverUsers.map(u => formatUserName(u)).join(', ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditResource(resource._id)}
                      className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
                    >
                      <PencilSquareIcon className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteResource(resource._id)}
                      className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* All Bookings Section */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium flex items-center">
            <CalendarDaysIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
            All Bookings
            {allBookings && allBookings.length > 0 && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-normal">
                ({allBookings.length})
              </span>
            )}
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {!allBookings || allBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <InboxIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No bookings have been made yet.</p>
            </div>
          ) : (
            [...allBookings].sort((a, b) => b.createdAt - a.createdAt).map((booking) => {
              const startDate = new Date(booking.startDate + 'T00:00:00');
              const formatTime = (timeStr: string) => {
                const [hours, minutes] = timeStr.split(':');
                const hour = parseInt(hours, 10);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const hour12 = hour % 12 || 12;
                return `${hour12}:${minutes} ${ampm}`;
              };
              
              return (
                <div key={booking._id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="text-center min-w-[50px]">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {startDate.toLocaleDateString('en-AU', { weekday: 'short' })}
                      </div>
                      <div className="text-lg font-bold">{startDate.getDate()}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {startDate.toLocaleDateString('en-AU', { month: 'short' })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{booking.resource?.name}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeClasses(booking.status)}`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {booking.isAllDay ? (
                          'All day'
                        ) : booking.startTime && booking.endTime ? (
                          `${formatTime(booking.startTime)} - ${formatTime(booking.endTime)}`
                        ) : (
                          'All day'
                        )}
                        {booking.endDate && booking.endDate !== booking.startDate && (
                          <span className="ml-1">→ {new Date(booking.endDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Requested by {formatUserName(booking.requestedByUser)} • {getRelativeTimeString(booking.createdAt)}
                      </div>
                      {booking.notes && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                          {booking.notes}
                        </div>
                      )}
                      {booking.reviewedBy && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Reviewed by {formatUserName(booking.reviewedByUser)}
                          {booking.reviewedAt && ` • ${getRelativeTimeString(booking.reviewedAt)}`}
                        </div>
                      )}
                      {booking.reviewNotes && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Review: {booking.reviewNotes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default AdminTab;
