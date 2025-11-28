import { useState } from "react";
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
import { XMarkIcon, CalendarDaysIcon, ClockIcon } from "@heroicons/react/24/outline";
import { useIsMobile } from "@/hooks/use-mobile";

interface BookingRequestFormProps {
  onClose: () => void;
}

export function BookingRequestForm({ onClose }: BookingRequestFormProps) {
  const isMobile = useIsMobile();
  
  const activeResources = useQuery(api.bookings.getActiveBookingResources);
  const createBooking = useMutation(api.bookings.createBooking);

  const [selectedResource, setSelectedResource] = useState<Id<"bookingResources"> | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    
    if (!notes.trim()) {
      toast.error('Please provide a reason for booking');
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
      await createBooking({
        resourceId: selectedResource as Id<"bookingResources">,
        startDate,
        endDate: isMultiDay && endDate ? endDate : undefined,
        startTime: isAllDay ? undefined : startTime,
        endTime: isAllDay ? undefined : endTime,
        isAllDay,
        notes: notes.trim(),
      });

      toast.success('Booking request submitted', {
        description: 'Your booking request has been sent for approval.',
      });

      onClose();
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get selected resource name for display
  const selectedResourceName = activeResources?.find(r => r._id === selectedResource)?.name;

  // Form content - shared between mobile and desktop
  const formContent = (
    <form id="booking-form" onSubmit={handleSubmit} className="space-y-5">
      {/* Step 1: What do you want to book? */}
      <div>
        <label htmlFor="resource" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          What do you want to book?
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

      {/* Step 2: When? - Only show after resource selected */}
      {selectedResource && (
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          {/* Date Selection */}
          <div className="mb-4">
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isMultiDay ? 'Start Date' : 'Date'}
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none"
              style={{ colorScheme: 'light dark' }}
            />
          </div>

          {/* Multi-day checkbox */}
          <label className="flex items-center gap-3 mb-4 cursor-pointer">
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
            <div className="mb-4">
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none"
                style={{ colorScheme: 'light dark' }}
              />
            </div>
          )}

          {/* All Day Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg mb-4">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {isMultiDay ? 'Start Time' : 'From'}
                </label>
                <input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  style={{ colorScheme: 'light dark' }}
                />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {isMultiDay ? 'End Time' : 'To'}
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  style={{ colorScheme: 'light dark' }}
                />
              </div>
            </div>
          )}

          {/* Helper text for multi-day with time */}
          {isMultiDay && !isAllDay && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Start time applies to the first day, end time applies to the last day.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Why? - Only show after date selected */}
      {selectedResource && startDate && (
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for booking
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g., Training exercise, Community event, Equipment transport..."
            className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
        </div>
      )}

      {/* Summary - Show when form is mostly complete */}
      {selectedResource && startDate && notes.trim() && (
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Booking Summary</h4>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <p><span className="font-medium">Resource:</span> {selectedResourceName}</p>
              <p className="flex items-center gap-1">
                <CalendarDaysIcon className="h-4 w-4" />
                <span className="font-medium">Date:</span> {new Date(startDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                {isMultiDay && endDate && ` - ${new Date(endDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`}
              </p>
              {!isAllDay && startTime && endTime && (
                <p className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  <span className="font-medium">Time:</span> {startTime} - {endTime}
                </p>
              )}
              {isAllDay && <p><span className="font-medium">Duration:</span> All day</p>}
            </div>
          </div>
        </div>
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
        form="booking-form" 
        disabled={isSubmitting || !selectedResource || !startDate || !notes.trim() || (isMultiDay && !endDate) || (!isAllDay && (!startTime || !endTime))}
        className="flex-1 h-12 text-base bg-red-700 hover:bg-red-800"
      >
        {isSubmitting ? "Submitting..." : "Submit Request"}
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
                Request a Booking
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
            Request a Booking
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
