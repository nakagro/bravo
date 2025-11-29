import { useState, useMemo, Fragment } from "react";
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
import { XMarkIcon, CalendarDaysIcon, ClockIcon, UserIcon, MagnifyingGlassIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { Combobox, Transition } from "@headlessui/react";
import { useIsMobile } from "@/hooks/use-mobile";

interface BookingRequestFormProps {
  onClose: () => void;
}

export function BookingRequestForm({ onClose }: BookingRequestFormProps) {
  const isMobile = useIsMobile();
  
  const activeResources = useQuery(api.bookings.getActiveBookingResources);
  const allUsers = useQuery(api.bookings.getAllUsers);
  const currentUser = useQuery(api.auth.loggedInUser);
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
  const [onBehalfOf, setOnBehalfOf] = useState<Id<"users"> | '__blocked__' | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Check if current user can book on behalf of others for the selected resource
  const canBookOnBehalf = useMemo(() => {
    if (!selectedResource || !currentUser || !activeResources) return false;
    const resource = activeResources.find(r => r._id === selectedResource);
    if (!resource) return false;
    const isApprover = resource.approvers.includes(currentUser._id);
    const isAdmin = currentUser.isAdmin === true;
    return isApprover || isAdmin;
  }, [selectedResource, currentUser, activeResources]);

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
      const isBlocked = onBehalfOf === '__blocked__';
      await createBooking({
        resourceId: selectedResource as Id<"bookingResources">,
        startDate,
        endDate: isMultiDay && endDate ? endDate : undefined,
        startTime: isAllDay ? undefined : startTime,
        endTime: isAllDay ? undefined : endTime,
        isAllDay,
        notes: notes.trim(),
        onBehalfOf: onBehalfOf && onBehalfOf !== '__blocked__' ? onBehalfOf as Id<"users"> : undefined,
        isBlocked,
      });

      const isOnBehalf = onBehalfOf && onBehalfOf !== '__blocked__' && onBehalfOf !== currentUser?._id;
      toast.success(
        isBlocked ? 'Resource blocked' : (isOnBehalf ? 'Booking created' : 'Booking request submitted'), 
        {
          description: isBlocked 
            ? 'The resource has been blocked for the selected dates.'
            : isOnBehalf 
              ? 'The booking has been created and auto-approved.'
              : 'Your booking request has been sent for approval.',
        }
      );

      onClose();
    } catch (error) {
      console.error('Error creating booking:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      
      // Check if this is a booking conflict error
      if (errorMessage.includes('already booked') || errorMessage.includes('conflict')) {
        setConflictError(errorMessage);
        setShowErrorDetails(false); // Reset details visibility
      } else {
        toast.error('Failed to create booking', {
          description: errorMessage,
        });
      }
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
              onChange={(e) => { setStartDate(e.target.value); setConflictError(null); }}
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
                onChange={(e) => { setEndDate(e.target.value); setConflictError(null); }}
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
                  onChange={(e) => { setStartTime(e.target.value); setConflictError(null); }}
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
                  onChange={(e) => { setEndTime(e.target.value); setConflictError(null); }}
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

          {/* Conflict Error Display */}
          {conflictError && (() => {
            // Extract clean message from Convex error
            // Convex errors look like: "[CONVEX M(...)] ... Uncaught Error: <actual message> at handler..."
            let cleanMessage = conflictError;
            const uncaughtMatch = conflictError.match(/Uncaught Error:\s*(.+?)(?:\s+at\s+handler|$)/i);
            if (uncaughtMatch) {
              cleanMessage = uncaughtMatch[1].trim();
            } else {
              // Try to extract just the meaningful part
              const alreadyBookedMatch = conflictError.match(/(This resource is already booked[^.]+\.)/i);
              if (alreadyBookedMatch) {
                cleanMessage = alreadyBookedMatch[1];
              }
            }
            
            return (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Booking Conflict
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {cleanMessage}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                      Please choose a different date or time.
                    </p>
                    
                    {/* Expandable technical details */}
                    {conflictError !== cleanMessage && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setShowErrorDetails(!showErrorDetails)}
                          className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
                        >
                          <svg 
                            className={`h-3 w-3 transition-transform ${showErrorDetails ? 'rotate-90' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {showErrorDetails ? 'Hide' : 'Show'} technical details
                        </button>
                        {showErrorDetails && (
                          <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs text-red-600 dark:text-red-300 overflow-x-auto whitespace-pre-wrap break-all">
                            {conflictError}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setConflictError(null); setShowErrorDetails(false); }}
                  className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline"
                >
                  Dismiss
                </button>
              </div>
            );
          })()}
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

      {/* Step 4: On behalf of (approvers/admins only) */}
      {selectedResource && startDate && canBookOnBehalf && (
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <UserIcon className="h-4 w-4 text-gray-500" />
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Book on behalf of (optional)
            </span>
          </div>
          
          <Combobox<Id<"users"> | "__blocked__" | null> value={onBehalfOf} onChange={setOnBehalfOf} nullable>
            <div className="relative">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <Combobox.Input
                  className="w-full pl-10 pr-10 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  displayValue={(userId: Id<"users"> | string | null) => {
                    if (!userId) return '';
                    if (userId === '__blocked__') return '🚫 Block/Unavailable (no user)';
                    const user = allUsers?.find((u) => u._id === userId);
                    if (!user) return '';
                    return user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : user.name || 'Unknown User';
                  }}
                  onChange={(event) => setUserSearchQuery(event.target.value)}
                  placeholder="Search for a member..."
                />
                {onBehalfOf ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOnBehalfOf(null);
                      setUserSearchQuery('');
                    }}
                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    <XCircleIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
                  </button>
                ) : (
                  <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </Combobox.Button>
                )}
              </div>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
                afterLeave={() => setUserSearchQuery('')}
              >
                <Combobox.Options className="absolute z-50 bottom-full mb-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {/* Special option: Block without user */}
                  <Combobox.Option
                    key="__blocked__"
                    className={({ active }) =>
                      `relative cursor-default select-none py-3 pl-10 pr-4 border-b border-gray-200 dark:border-gray-700 ${
                        active ? 'bg-red-600 text-white' : 'text-gray-900 dark:text-gray-200'
                      }`
                    }
                    value="__blocked__"
                  >
                    {({ selected, active }) => (
                      <>
                        <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                          🚫 Block/Unavailable (no user)
                        </span>
                        {selected && (
                          <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-red-600'}`}>
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </>
                    )}
                  </Combobox.Option>
                  
                  {(() => {
                    const otherUsers = allUsers?.filter(u => u._id !== currentUser?._id) || [];
                    const filteredUsers = userSearchQuery === ''
                      ? otherUsers
                      : otherUsers.filter((user) => {
                          const displayName = user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}`.toLowerCase()
                            : (user.name || '').toLowerCase();
                          return displayName.includes(userSearchQuery.toLowerCase());
                        });
                    
                    if (filteredUsers.length === 0 && userSearchQuery !== '') {
                      return (
                        <div className="relative cursor-default select-none py-3 px-4 text-gray-500 dark:text-gray-400">
                          No members found.
                        </div>
                      );
                    }
                    
                    return filteredUsers
                      .slice()
                      .sort((a, b) => {
                        const nameA = (a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : a.name || '').toLowerCase();
                        const nameB = (b.firstName && b.lastName ? `${b.firstName} ${b.lastName}` : b.name || '').toLowerCase();
                        return nameA.localeCompare(nameB);
                      })
                      .map((user) => (
                        <Combobox.Option
                          key={user._id}
                          className={({ active }) =>
                            `relative cursor-default select-none py-3 pl-10 pr-4 ${
                              active ? 'bg-red-600 text-white' : 'text-gray-900 dark:text-gray-200'
                            }`
                          }
                          value={user._id}
                        >
                          {({ selected, active }) => (
                            <>
                              <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                {user.firstName && user.lastName 
                                  ? `${user.firstName} ${user.lastName}` 
                                  : user.name || 'Unknown User'}
                              </span>
                              {selected && (
                                <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-red-600'}`}>
                                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                </span>
                              )}
                            </>
                          )}
                        </Combobox.Option>
                      ));
                  })()}
                </Combobox.Options>
              </Transition>
            </div>
          </Combobox>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            As an approver, you can create bookings for other members. These will be auto-approved.
          </p>
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
