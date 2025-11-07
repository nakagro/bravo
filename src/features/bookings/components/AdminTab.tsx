import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { getRelativeTimeString } from "../../../utils/dateUtils";

interface AdminTabProps {
  isAuthenticated: boolean;
}

const AdminTab: React.FC<AdminTabProps> = ({ isAuthenticated }) => {
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Id<"bookingResources"> | null>(null);
  const [resourceName, setResourceName] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceApprovers, setResourceApprovers] = useState<Id<"users">[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resources = useQuery(api.bookings.getBookingResources);
  const allBookings = useQuery(api.bookings.getBookings);
  const allUsers = useQuery(api.bookings.getAllUsers);
  const pendingApprovals = useQuery(api.bookings.getPendingApprovalsForMe);
  
  const createResource = useMutation(api.bookings.createBookingResource);
  const updateResource = useMutation(api.bookings.updateBookingResource);
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

  const handleEditResource = (resource: any) => {
    setEditingResource(resource._id);
    setResourceName(resource.name);
    setResourceDescription(resource.description || '');
    setResourceApprovers(resource.approvers);
    setIsActive(resource.isActive);
    setShowResourceForm(true);
  };

  const handleResetForm = () => {
    setShowResourceForm(false);
    setEditingResource(null);
    setResourceName('');
    setResourceDescription('');
    setResourceApprovers([]);
    setIsActive(true);
  };

  const handleSubmitResource = async () => {
    if (!resourceName.trim() || resourceApprovers.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingResource) {
        await updateResource({
          resourceId: editingResource,
          name: resourceName.trim(),
          description: resourceDescription.trim() || undefined,
          isActive,
          approvers: resourceApprovers,
        });
        toast.success('Resource updated successfully');
      } else {
        await createResource({
          name: resourceName.trim(),
          description: resourceDescription.trim() || undefined,
          approvers: resourceApprovers,
        });
        toast.success('Resource created successfully');
      }

      handleResetForm();
    } catch (error) {
      console.error('Error saving resource:', error);
      toast.error('Failed to save resource', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
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

  const getStatusColor = (status: string) => {
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
    <div className="space-y-6">
      {/* Pending Approvals Section */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-yellow-900 dark:text-yellow-100 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending Approvals ({pendingApprovals.length})
          </h2>
          <div className="space-y-3">
            {pendingApprovals.map((booking) => (
              <div key={booking._id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-300 dark:border-yellow-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{booking.resource?.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Requested by: <span className="font-medium">{formatUserName(booking.requestedByUser)}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {getRelativeTimeString(booking.createdAt)}
                    </p>
                    {booking.notes && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 italic">
                        "{booking.notes}"
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveBooking(booking._id)}
                      className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectBooking(booking._id)}
                      className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                    >
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
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Manage Resources
          </h2>
          {!showResourceForm && (
            <button
              onClick={() => setShowResourceForm(true)}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              + Add Resource
            </button>
          )}
        </div>

        {showResourceForm && (
          <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <h3 className="font-semibold mb-4">
              {editingResource ? 'Edit Resource' : 'New Resource'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Resource Name *
                </label>
                <input
                  type="text"
                  value={resourceName}
                  onChange={(e) => setResourceName(e.target.value)}
                  placeholder="e.g., Pumper, Meeting Room"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={resourceDescription}
                  onChange={(e) => setResourceDescription(e.target.value)}
                  rows={2}
                  placeholder="Additional details about this resource..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Approvers * (Hold Ctrl/Cmd to select multiple)
                </label>
                <select
                  multiple
                  value={resourceApprovers}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value as Id<"users">);
                    setResourceApprovers(selected);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  size={5}
                >
                  {allUsers?.map((user) => (
                    <option key={user._id} value={user._id}>
                      {formatUserName(user)} {user.rank ? `(${user.rank})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Selected: {resourceApprovers.length} user(s)
                </p>
              </div>

              {editingResource && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Resource is active (can be booked)
                  </label>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSubmitResource}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Saving...' : (editingResource ? 'Update' : 'Create')}
                </button>
                <button
                  onClick={handleResetForm}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resources List */}
        {!resources || resources.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No resources have been created yet.
          </p>
        ) : (
          <div className="space-y-3">
            {resources.map((resource) => (
              <div key={resource._id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{resource.name}</h3>
                      {!resource.isActive && (
                        <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs font-medium">
                          Inactive
                        </span>
                      )}
                    </div>
                    {resource.description && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {resource.description}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      <span className="font-medium">Approvers:</span>{' '}
                      {resource.approverUsers.map(u => formatUserName(u)).join(', ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditResource(resource)}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteResource(resource._id)}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Bookings Section */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          All Bookings
        </h2>

        {!allBookings || allBookings.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No bookings have been made yet.
          </p>
        ) : (
          <div className="space-y-3">
            {allBookings.map((booking) => (
              <div key={booking._id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{booking.resource?.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Requested by: <span className="font-medium">{formatUserName(booking.requestedByUser)}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {getRelativeTimeString(booking.createdAt)}
                    </p>
                    {booking.notes && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                        <span className="font-medium">Request notes:</span> {booking.notes}
                      </p>
                    )}
                    {booking.reviewedBy && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Reviewed by: <span className="font-medium">{formatUserName(booking.reviewedByUser)}</span>
                        {booking.reviewedAt && ` ${getRelativeTimeString(booking.reviewedAt)}`}
                      </p>
                    )}
                    {booking.reviewNotes && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        <span className="font-medium">Review notes:</span> {booking.reviewNotes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTab;
