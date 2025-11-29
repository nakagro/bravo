import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { XMarkIcon, TrashIcon, UserIcon } from "@heroicons/react/24/outline";
import { useIsMobile } from "@/hooks/use-mobile";

interface BookingEditFormProps {
  bookingId: Id<"bookings">;
  onClose: () => void;
}

// Type for booking data from the query
interface BookingData {
  _id: Id<"bookings">;
  resourceId: Id<"bookingResources">;
  requestedBy: Id<"users">;
  status: "pending" | "approved" | "rejected" | "cancelled";
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  notes?: string;
  createdAt: number;
  requestedByUser?: {
    _id: Id<"users">;
    firstName?: string;
    lastName?: string;
    name?: string;
  };
  resource?: {
    _id: Id<"bookingResources">;
    name: string;
  };
}

export function BookingEditForm({ bookingId, onClose }: BookingEditFormProps) {
  const isMobile = useIsMobile();
  
  const activeResources = useQuery(api.bookings.getActiveBookingResources);
  const allBookings = useQuery(api.bookings.getBookings);
  const updateBooking = useMutation(api.bookings.updateBooking);
  const cancelBooking = useMutation(api.bookings.cancelBooking);

  // Find the booking from the list
  const existingBooking = allBookings?.find(b => b._id === bookingId) as BookingData | undefined;

  const [selectedResource, setSelectedResource] = useState<Id<"bookingResources"> | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "cancelled">("pending");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing booking data
  useEffect(() => {
    if (existingBooking) {
      setSelectedResource(existingBooking.resourceId);
      setStartDate(existingBooking.startDate);
      setEndDate(existingBooking.endDate || '');
      setStartTime(existingBooking.startTime || '');
      setEndTime(existingBooking.endTime || '');
      setIsAllDay(existingBooking.isAllDay);
      setIsMultiDay(!!existingBooking.endDate && existingBooking.endDate !== existingBooking.startDate);
      setNotes(existingBooking.notes || '');
      setStatus(existingBooking.status);
    }
  }, [existingBooking]);

  // Format user display name
  const formatUserName = (user: { firstName?: string; lastName?: string; name?: string } | undefined) => {
    if (!user) return "Unknown User";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.name) {
      return user.name;
    }
    return "Unknown User";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedResource) {
      toast.error('Please select a resource');
      return;
    }
    
    if (!startDate) {
      toast.error('Please select a date');
      return;
    }
    
    if (!isAllDay && (!startTime || !endTime)) {
      toast.error('Please select start and end times');
      return;
    }
    
    if (!isAllDay && startTime && endTime && startTime >= endTime && !isMultiDay) {
      toast.error('End time must be after start time');
      return;
    }

    if (isMultiDay && !endDate) {
      toast.error('Please select an end date');
      return;
    }

    setIsSubmitting(true);

    try {
      await updateBooking({
        bookingId,
        resourceId: selectedResource as Id<"bookingResources">,
        startDate,
        endDate: isMultiDay ? endDate : '',
        startTime: isAllDay ? '' : startTime,
        endTime: isAllDay ? '' : endTime,
        isAllDay,
        notes: notes.trim(),
        status,
      });

      toast.success('Booking updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating booking:', error);
      toast.error('Failed to update booking', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await updateBooking({
        bookingId,
        status: 'cancelled',
      });
      toast.success('Booking cancelled');
      onClose();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('Failed to cancel booking', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!existingBooking) {
    return null;
  }

  // Form content - shared between mobile and desktop
  const formContent = (
    <form id="booking-edit-form" onSubmit={handleSubmit} className="space-y-5">
      {/* Requester Info */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <UserIcon className="h-5 w-5 text-gray-500" />
        <div>
          <div className="text-sm font-medium">Requested by {formatUserName(existingBooking.requestedByUser)}</div>
          <div className="text-xs text-gray-500">
            {new Date(existingBooking.createdAt).toLocaleDateString('en-AU', { 
              day: 'numeric', 
              month: 'short', 
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </div>
        </div>
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Resource Selection */}
      <div>
        <label htmlFor="resource" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Resource
        </label>
        <select
          id="resource"
          value={selectedResource}
          onChange={(e) => setSelectedResource(e.target.value as Id<"bookingResources">)}
          className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">Select a resource...</option>
          {activeResources?.map((resource) => (
            <option key={resource._id} value={resource._id}>
              {resource.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date Selection */}
      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {isMultiDay ? 'Start Date' : 'Date'}
        </label>
        <div className="relative">
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none ${!startDate ? 'text-transparent' : ''}`}
            style={{ colorScheme: 'light dark' }}
          />
          {/* iOS placeholder overlay */}
          {!startDate && (
            <span className="absolute inset-0 flex items-center px-4 py-3 text-gray-400 dark:text-gray-500 pointer-events-none text-base border border-transparent">
              Select date
            </span>
          )}
        </div>
      </div>

      {/* Multi-day checkbox */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isMultiDay}
          onChange={(e) => {
            setIsMultiDay(e.target.checked);
            if (!e.target.checked) setEndDate('');
          }}
          className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">Multiple days</span>
      </label>

      {/* End Date - only if multi-day */}
      {isMultiDay && (
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            End Date
          </label>
          <div className="relative">
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className={`w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none ${!endDate ? 'text-transparent' : ''}`}
              style={{ colorScheme: 'light dark' }}
            />
            {/* iOS placeholder overlay */}
            {!endDate && (
              <span className="absolute inset-0 flex items-center px-4 py-3 text-gray-400 dark:text-gray-500 pointer-events-none text-base border border-transparent">
                Select end date
              </span>
            )}
          </div>
        </div>
      )}

      {/* All Day Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">All day</span>
        <button
          type="button"
          onClick={() => setIsAllDay(!isAllDay)}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            isAllDay ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              isAllDay ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Time Selection - only if not all day */}
      {!isAllDay && (
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isMultiDay ? 'Start Time' : 'From'}
            </label>
            <div className="relative">
              <input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${!startTime ? 'text-transparent' : ''}`}
                style={{ colorScheme: 'light dark' }}
              />
              {/* iOS placeholder overlay */}
              {!startTime && (
                <span className="absolute inset-0 flex items-center px-3 py-3 text-gray-400 dark:text-gray-500 pointer-events-none text-base border border-transparent">
                  Select time
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isMultiDay ? 'End Time' : 'To'}
            </label>
            <div className="relative">
              <input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-full px-3 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${!endTime ? 'text-transparent' : ''}`}
                style={{ colorScheme: 'light dark' }}
              />
              {/* iOS placeholder overlay */}
              {!endTime && (
                <span className="absolute inset-0 flex items-center px-3 py-3 text-gray-400 dark:text-gray-500 pointer-events-none text-base border border-transparent">
                  Select time
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Reason for booking
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="e.g., Training exercise, Community event..."
          className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
        />
      </div>

      {/* Delete Button */}
      {status !== 'cancelled' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="w-full py-3 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <TrashIcon className="h-5 w-5" />
              Cancel Booking
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel the booking for {existingBooking.resource?.name}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Booking</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Cancel Booking
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </form>
  );

  // Footer with action buttons
  const formFooter = (
    <div className="flex gap-3 p-4 pb-8 md:pb-4 border-t border-gray-200 dark:border-gray-700 bg-background">
      <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-base">
        Cancel
      </Button>
      <Button 
        type="submit" 
        form="booking-edit-form" 
        disabled={isSubmitting || !selectedResource || !startDate || (isMultiDay && !endDate) || (!isAllDay && (!startTime || !endTime))}
        className="flex-1 h-12 text-base bg-red-700 hover:bg-red-800"
      >
        {isSubmitting ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );

  // Mobile: Full-screen drawer sliding up from bottom
  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DrawerContent className="h-[95vh] flex flex-col border-gray-700">
          <DrawerHeader className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-xl font-bold">
                Edit Booking
              </DrawerTitle>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10">
                <XMarkIcon className="h-6 w-6" />
              </Button>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pt-4">
            {formContent}
          </div>
          <DrawerFooter className="flex-shrink-0 p-0">
            {formFooter}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Traditional dialog
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 dark:border-gray-700">
        <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="text-xl font-bold">
            Edit Booking
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4">
          {formContent}
        </div>
        <div className="flex-shrink-0">
          {formFooter}
        </div>
      </DialogContent>
    </Dialog>
  );
}
