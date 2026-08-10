import { useState, useMemo, Fragment } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveModal } from "../../../components/shared/ResponsiveModal";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { useDirtyDraftGuard } from "@/hooks/useDirtyDraftGuard";
import { DatePicker } from "../../../components/shared/DatePicker";
import { formatUserName, formatSummaryDate, formatTime, getBookingConflictMessage } from "../types";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ClockIcon,
  UserIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { Combobox, Transition } from "@headlessui/react";

const bookingRequestSchema = z
  .object({
    resourceId: z.string().min(1, "Please select a resource"),
    startDate: z.string().min(1, "Please select a date"),
    endDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    isAllDay: z.boolean(),
    isMultiDay: z.boolean(),
    // Required only for bookings that need approval; enforced in onSubmit
    notes: z.string(),
  })
  .refine((data) => !data.isMultiDay || data.endDate.length > 0, {
    message: "Please select an end date",
    path: ["endDate"],
  })
  .refine((data) => data.isAllDay || (data.startTime.length > 0 && data.endTime.length > 0), {
    message: "Please select start and end times",
    path: ["startTime"],
  })
  .refine(
    (data) =>
      data.isAllDay || data.isMultiDay || !data.startTime || !data.endTime || data.startTime < data.endTime,
    { message: "End time must be after start time", path: ["endTime"] }
  );

type BookingRequestValues = z.infer<typeof bookingRequestSchema>;

interface BookingRequestFormProps {
  onClose: () => void;
  initialDate?: string;
  initialResourceId?: Id<"bookingResources">;
}

export function BookingRequestForm({ onClose, initialDate, initialResourceId }: BookingRequestFormProps) {
  const isMobile = useIsMobile();
  const activeResources = useQuery(api.bookings.getActiveBookingResources);
  const allUsers = useQuery(api.bookings.getAllUsers);
  const currentUser = useQuery(api.auth.loggedInUser);
  const createBooking = useMutation(api.bookings.createBooking);

  // State outside the form (not part of the booking data model)
  const [onBehalfOf, setOnBehalfOf] = useState<Id<"users"> | "__blocked__" | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [conflictError, setConflictError] = useState<string | null>(null);

  const form = useForm<BookingRequestValues>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: {
      resourceId: initialResourceId ?? "",
      startDate: initialDate ?? "",
      endDate: "",
      startTime: "",
      endTime: "",
      isAllDay: true,
      isMultiDay: false,
      notes: "",
    },
  });

  const { isSubmitting, isDirty } = form.formState;
  // One confirmation for every exit from a half-filled form: the X, Cancel,
  // Escape, an outside tap, the drawer swipe and the Back button.
  const guard = useDirtyDraftGuard(isDirty, onClose);
  const watchResourceId = form.watch("resourceId");
  const watchStartDate = form.watch("startDate");
  const watchIsAllDay = form.watch("isAllDay");
  const watchIsMultiDay = form.watch("isMultiDay");
  const watchEndDate = form.watch("endDate");

  // Filter resources based on permissions
  const bookableResources = useMemo(() => {
    if (!activeResources || !currentUser) return [];
    const isAdmin = currentUser.isAdmin === true;
    return activeResources.map((resource) => {
      const isApprover = resource.approvers.includes(currentUser._id);
      const canBook = !resource.approverOnly || isApprover || isAdmin;
      return { ...resource, canBook, isApprover, isAdmin };
    });
  }, [activeResources, currentUser]);

  // Can this user book on behalf of others for the selected resource?
  const canBookOnBehalf = useMemo(() => {
    if (!watchResourceId || !currentUser || !activeResources) return false;
    const resource = activeResources.find((r) => r._id === watchResourceId);
    if (!resource) return false;
    return resource.approvers.includes(currentUser._id) || currentUser.isAdmin === true;
  }, [watchResourceId, currentUser, activeResources]);

  // Info about selected resource
  const selectedResourceInfo = useMemo(() => {
    if (!watchResourceId) return null;
    return bookableResources.find((r) => r._id === watchResourceId);
  }, [watchResourceId, bookableResources]);

  // Bookings by approvers/admins are auto-approved, so a reason is optional for them
  const willAutoApprove = Boolean(
    selectedResourceInfo && (selectedResourceInfo.isApprover || selectedResourceInfo.isAdmin)
  );

  // Live availability for the selected resource and date range, so the user
  // sees clashes before submitting instead of via a rejection error
  const availabilityArgs =
    watchResourceId && watchStartDate
      ? {
          startDate: watchStartDate,
          endDate: (watchIsMultiDay && watchEndDate) || watchStartDate,
          resourceId: watchResourceId as Id<"bookingResources">,
        }
      : "skip";
  const existingBookingsForDate = useQuery(api.bookings.getBookingsForDateRange, availabilityArgs);

  const onSubmit = async (values: BookingRequestValues) => {
    if (!willAutoApprove && !values.notes.trim()) {
      form.setError("notes", { message: "Please provide a reason for booking" });
      return;
    }
    try {
      const isBlocked = onBehalfOf === "__blocked__";
      await createBooking({
        resourceId: values.resourceId as Id<"bookingResources">,
        startDate: values.startDate,
        endDate: values.isMultiDay && values.endDate ? values.endDate : undefined,
        startTime: values.isAllDay ? undefined : values.startTime,
        endTime: values.isAllDay ? undefined : values.endTime,
        isAllDay: values.isAllDay,
        notes: values.notes.trim() || undefined,
        onBehalfOf:
          onBehalfOf && onBehalfOf !== "__blocked__" ? (onBehalfOf as Id<"users">) : undefined,
        isBlocked,
      });

      const isOnBehalf =
        onBehalfOf && onBehalfOf !== "__blocked__" && onBehalfOf !== currentUser?._id;
      toast.success(
        isBlocked
          ? "Resource blocked"
          : isOnBehalf
            ? "Booking created"
            : "Booking request submitted",
        {
          description: isBlocked
            ? "The resource has been blocked for the selected dates."
            : isOnBehalf
              ? "The booking has been created and auto-approved."
              : "Your booking request has been sent for approval.",
        }
      );
      guard.release();
      onClose();
    } catch (error) {
      console.error("Error creating booking:", error);
      const conflictMessage = getBookingConflictMessage(error);
      if (conflictMessage) {
        setConflictError(conflictMessage);
      } else {
        toast.error("Failed to create booking", {
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      }
    }
  };

  const formContent = (
    <Form {...form}>
      <form id="booking-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Step 1: Resource selection */}
        <FormField
          control={form.control}
          name="resourceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                What do you want to book?
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-12 px-4 text-base rounded-lg">
                    <SelectValue placeholder="Select a resource..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bookableResources
                    ?.filter((r) => r.canBook)
                    .map((resource) => (
                      <SelectItem key={resource._id} value={resource._id}>
                        {resource.name}
                        {resource.approverOnly ? " 🔒" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
              {selectedResourceInfo?.approverOnly && (
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                    <LockClosedIcon className="h-4 w-4 flex-shrink-0" />
                    <span>
                      This is an approver-only resource. Your booking will be auto-approved.
                    </span>
                  </div>
                </div>
              )}
            </FormItem>
          )}
        />

        {/* Step 2: Date/Time - only after resource selected */}
        {watchResourceId && (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
            {/* Start Date */}
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {watchIsMultiDay ? "Start Date" : "Date"}
                  </FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={(val) => {
                        field.onChange(val);
                        setConflictError(null);
                      }}
                      min={format(new Date(), "yyyy-MM-dd")}
                      placeholder="Select date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Multi-day checkbox */}
            <FormField
              control={form.control}
              name="isMultiDay"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                        if (!e.target.checked) form.setValue("endDate", "");
                      }}
                      className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Multiple days</span>
                  </label>
                </FormItem>
              )}
            />

            {/* End Date */}
            {watchIsMultiDay && (
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      End Date
                    </FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value}
                        onChange={(val) => {
                          field.onChange(val);
                          setConflictError(null);
                        }}
                        min={form.getValues("startDate") || format(new Date(), "yyyy-MM-dd")}
                        placeholder="Select end date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Existing bookings for the selected date(s) */}
            {watchStartDate && existingBookingsForDate !== undefined && (
              <div
                className={`p-3 rounded-lg border text-sm ${
                  existingBookingsForDate.length === 0
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                    : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                }`}
              >
                {existingBookingsForDate.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 flex-shrink-0" />
                    <span>No existing bookings, this resource is free on the selected date{watchIsMultiDay ? "s" : ""}.</span>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-amber-800 dark:text-amber-200 mb-1.5">
                      Already booked during this period:
                    </p>
                    <ul className="space-y-1 text-amber-700 dark:text-amber-300">
                      {existingBookingsForDate.map((b) => (
                        <li key={b._id} className="flex items-center gap-1.5">
                          <ClockIcon className="h-4 w-4 flex-shrink-0" />
                          <span>
                            {formatSummaryDate(b.startDate)}
                            {b.endDate && b.endDate !== b.startDate && ` - ${formatSummaryDate(b.endDate)}`}
                            {": "}
                            {b.isAllDay || !b.startTime || !b.endTime
                              ? "All day"
                              : `${formatTime(b.startTime)} - ${formatTime(b.endTime)}`}
                            {b.status === "pending" && " (awaiting approval)"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* All Day Toggle */}
            <FormField
              control={form.control}
              name="isAllDay"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg cursor-pointer">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      All day
                    </span>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="All day"
                        className="h-7 w-12 [&>span]:h-6 [&>span]:w-6 [&>span]:data-[state=checked]:translate-x-5"
                      />
                    </FormControl>
                  </label>
                </FormItem>
              )}
            />

            {/* Time Selection */}
            {!watchIsAllDay && (
              <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-4"}>
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {watchIsMultiDay ? "Start Time" : "From"}
                      </FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            setConflictError(null);
                          }}
                          type="time"
                          className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {watchIsMultiDay ? "End Time" : "To"}
                      </FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            setConflictError(null);
                          }}
                          type="time"
                          className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Helper text for multi-day with time */}
            {watchIsMultiDay && !watchIsAllDay && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Start time applies to the first day, end time applies to the last day.
              </p>
            )}

            {/* Conflict Error Display */}
            {conflictError && (
              <ConflictErrorBanner
                conflictError={conflictError}
                onDismiss={() => setConflictError(null)}
              />
            )}
          </div>
        )}

        {/* Step 3: Reason - only after date selected */}
        {watchResourceId && watchStartDate && (
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reason for booking{willAutoApprove ? " (optional)" : ""}
                </FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    rows={3}
                    placeholder="e.g., Training exercise, Community event, Equipment transport..."
                    className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Step 4: On behalf of (approvers/admins only) */}
        {watchResourceId && watchStartDate && canBookOnBehalf && (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <UserIcon className="h-4 w-4 text-gray-500" />
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Book on behalf of (optional)
              </span>
            </div>

            <Combobox<Id<"users"> | "__blocked__" | null>
              value={onBehalfOf}
              onChange={setOnBehalfOf}
              nullable
            >
              <div className="relative">
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </div>
                  <Combobox.Input
                    className="w-full pl-10 pr-10 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    displayValue={(userId: Id<"users"> | string | null) => {
                      if (!userId) return "";
                      if (userId === "__blocked__") return "Block/Unavailable (no user)";
                      const user = allUsers?.find((u) => u._id === userId);
                      if (!user) return "";
                      return formatUserName(user);
                    }}
                    onChange={(event) => setUserSearchQuery(event.target.value)}
                    placeholder="Search for a member..."
                  />
                  {onBehalfOf ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOnBehalfOf(null);
                        setUserSearchQuery("");
                      }}
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                    >
                      <XCircleIcon
                        className="h-5 w-5 text-gray-400 hover:text-gray-600"
                        aria-hidden="true"
                      />
                    </button>
                  ) : (
                    <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <ChevronUpDownIcon
                        className="h-5 w-5 text-gray-400"
                        aria-hidden="true"
                      />
                    </Combobox.Button>
                  )}
                </div>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                  afterLeave={() => setUserSearchQuery("")}
                >
                  <Combobox.Options className="absolute z-50 bottom-full mb-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    {/* Block option */}
                    <Combobox.Option
                      key="__blocked__"
                      className={({ active }) =>
                        `relative cursor-default select-none py-3 pl-10 pr-4 border-b border-gray-200 dark:border-gray-700 ${
                          active
                            ? "bg-red-600 text-white"
                            : "text-gray-900 dark:text-gray-200"
                        }`
                      }
                      value="__blocked__"
                    >
                      {({ selected, active }) => (
                        <>
                          <span
                            className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
                          >
                            Block/Unavailable (no user)
                          </span>
                          {selected && (
                            <span
                              className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? "text-white" : "text-red-600"}`}
                            >
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          )}
                        </>
                      )}
                    </Combobox.Option>

                    {(() => {
                      const otherUsers =
                        allUsers?.filter((u) => u._id !== currentUser?._id) || [];
                      const filteredUsers =
                        userSearchQuery === ""
                          ? otherUsers
                          : otherUsers.filter((user) => {
                              const displayName = formatUserName(user).toLowerCase();
                              return displayName.includes(userSearchQuery.toLowerCase());
                            });

                      if (filteredUsers.length === 0 && userSearchQuery !== "") {
                        return (
                          <div className="relative cursor-default select-none py-3 px-4 text-gray-500 dark:text-gray-400">
                            No members found.
                          </div>
                        );
                      }

                      return filteredUsers
                        .slice()
                        .sort((a, b) =>
                          formatUserName(a)
                            .toLowerCase()
                            .localeCompare(formatUserName(b).toLowerCase())
                        )
                        .map((user) => (
                          <Combobox.Option
                            key={user._id}
                            className={({ active }) =>
                              `relative cursor-default select-none py-3 pl-10 pr-4 ${
                                active
                                  ? "bg-red-600 text-white"
                                  : "text-gray-900 dark:text-gray-200"
                              }`
                            }
                            value={user._id}
                          >
                            {({ selected, active }) => (
                              <>
                                <span
                                  className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
                                >
                                  {formatUserName(user)}
                                </span>
                                {selected && (
                                  <span
                                    className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? "text-white" : "text-red-600"}`}
                                  >
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

      </form>
    </Form>
  );

  const formFooter = (
    <div className="flex gap-3 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] md:pb-4 border-t border-gray-200 dark:border-gray-700 bg-background">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          if (guard.requestClose()) onClose();
        }}
        className="flex-1 h-12 text-base"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="booking-form"
        disabled={isSubmitting}
        className="flex-1 h-12 text-base bg-red-700 hover:bg-red-800"
      >
        {isSubmitting ? "Submitting..." : "Submit Request"}
      </Button>
    </div>
  );

  return (
    <>
      <ResponsiveModal
        open
        onClose={onClose}
        onRequestClose={guard.requestClose}
        title="Request a Booking"
        footer={formFooter}
        drawerHeight="h-[95vh]"
      >
        {formContent}
      </ResponsiveModal>

      <DeleteConfirmDialog
        open={guard.promptOpen}
        onOpenChange={guard.setPromptOpen}
        title="Discard this request?"
        description="This booking request hasn't been submitted. Leaving now will lose what you've entered."
        confirmLabel="Discard"
        onConfirm={guard.confirmDiscard}
      />
    </>
  );
}

// --- Sub-component for conflict error display ---

function ConflictErrorBanner({
  conflictError,
  onDismiss,
}: {
  conflictError: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
    >
      <div className="flex items-start gap-2">
        <XCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">Booking Conflict</p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{conflictError}</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">
            Please choose a different date or time.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline"
      >
        Dismiss
      </button>
    </div>
  );
}
