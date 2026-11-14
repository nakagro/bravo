import { useState, useMemo } from "react";
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
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useDirtyDraftGuard } from "@/hooks/useDirtyDraftGuard";
import { DatePicker } from "../../../components/shared/DatePicker";
import {
  formatUserName,
  formatSummaryDate,
  formatTime,
  getBookingConflictMessage,
  getSeriesClash,
} from "../types";
import {
  addDays,
  describeRepeat,
  repeatProblem,
  seriesDates,
  MAX_SERIES_DAYS,
  type BookingRepeatFrequency,
} from "../../../../convex/lib/bookingRecurrence";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { Clock, User, CircleX, Lock, Check, Repeat } from "lucide-react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { errorMessage } from "@/lib/errors";

const bookingRequestSchema = z
  .object({
    resourceId: z.string().min(1, "Please select a resource"),
    startDate: z.string().min(1, "Please select a date"),
    endDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    isAllDay: z.boolean(),
    isMultiDay: z.boolean(),
    repeat: z.enum(["none", "weekly", "fortnightly", "monthly"]),
    repeatUntil: z.string(),
    // Required only for bookings that need approval; enforced in onSubmit
    notes: z.string(),
  })
  .refine((data) => !data.isMultiDay || data.endDate.length > 0, {
    message: "Please select an end date",
    path: ["endDate"],
  })
  .refine((data) => data.repeat === "none" || data.repeatUntil.length > 0, {
    message: "Please choose when the repeat ends",
    path: ["repeatUntil"],
  })
  .superRefine((data, ctx) => {
    if (data.repeat === "none" || !data.startDate || !data.repeatUntil) return;
    const problem = repeatProblem(data.startDate, data.repeatUntil);
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["repeatUntil"] });
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
  const onBehalfOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "__blocked__", label: "Block/Unavailable (no user)" },
      ...(allUsers ?? [])
        .filter((u) => u._id !== currentUser?._id)
        .map((u) => ({ value: u._id, label: formatUserName(u) }))
        .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase())),
    ],
    [allUsers, currentUser?._id],
  );
  const [conflictError, setConflictError] = useState<string | null>(null);
  // Dates of a repeat that are already taken, offered back to the member to
  // book around rather than failing the whole series
  const [seriesClash, setSeriesClash] = useState<{ clashDates: string[]; total: number } | null>(
    null
  );

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
      repeat: "none",
      repeatUntil: "",
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
  const watchRepeat = form.watch("repeat");
  const watchRepeatUntil = form.watch("repeatUntil");
  const isRepeating = watchRepeat !== "none";

  // Every date the repeat will book, for the preview and the availability panel
  const repeatDates = useMemo(() => {
    if (!isRepeating || !watchStartDate || !watchRepeatUntil) return null;
    if (repeatProblem(watchStartDate, watchRepeatUntil)) return null;
    return seriesDates(watchStartDate, watchRepeat as BookingRepeatFrequency, watchRepeatUntil);
  }, [isRepeating, watchStartDate, watchRepeat, watchRepeatUntil]);

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
          endDate: repeatDates
            ? repeatDates[repeatDates.length - 1]
            : (watchIsMultiDay && watchEndDate) || watchStartDate,
          resourceId: watchResourceId as Id<"bookingResources">,
        }
      : "skip";
  const bookingsInRange = useQuery(api.bookings.getBookingsForDateRange, availabilityArgs);
  // A repeat spans weeks, but only the bookings on its own dates matter
  const existingBookingsForDate = useMemo(() => {
    if (!bookingsInRange || !repeatDates) return bookingsInRange;
    return bookingsInRange.filter((b) => {
      const end = b.endDate || b.startDate;
      return repeatDates.some((date) => b.startDate <= date && end >= date);
    });
  }, [bookingsInRange, repeatDates]);

  const clearClashes = () => {
    setConflictError(null);
    setSeriesClash(null);
  };

  const submit = async (values: BookingRequestValues, skipClashes: boolean) => {
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
        repeat:
          values.repeat === "none"
            ? undefined
            : { frequency: values.repeat, untilDate: values.repeatUntil },
        skipClashes: skipClashes || undefined,
        notes: values.notes.trim() || undefined,
        onBehalfOf:
          onBehalfOf && onBehalfOf !== "__blocked__" ? (onBehalfOf as Id<"users">) : undefined,
        isBlocked,
      });

      const isOnBehalf =
        onBehalfOf && onBehalfOf !== "__blocked__" && onBehalfOf !== currentUser?._id;
      const what =
        values.repeat === "none"
          ? null
          : `${describeRepeat(values.startDate, values.repeat)} until ${formatSummaryDate(values.repeatUntil)}.`;
      toast.success(
        isBlocked
          ? "Resource blocked"
          : isOnBehalf
            ? "Booking created"
            : "Booking request submitted",
        {
          description: [
            isBlocked
              ? "The resource has been blocked for the selected dates."
              : isOnBehalf
                ? "The booking has been created and auto-approved."
                : "Your booking request has been sent for approval.",
            what,
          ]
            .filter(Boolean)
            .join(" "),
        }
      );
      guard.release();
      onClose();
    } catch (error) {
      console.error("Error creating booking:", error);
      const clash = getSeriesClash(error);
      const conflictMessage = getBookingConflictMessage(error);
      if (clash) {
        setSeriesClash(clash);
      } else if (conflictMessage) {
        setConflictError(conflictMessage);
      } else {
        toast.error("Failed to create booking", {
          description: errorMessage(error, "An unexpected error occurred."),
        });
      }
    }
  };

  const onSubmit = (values: BookingRequestValues) => submit(values, false);

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
                    <Lock className="h-4 w-4 flex-shrink-0" />
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
                        clearClashes();
                      }}
                      min={format(new Date(), "yyyy-MM-dd")}
                      placeholder="Select date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Multi-day checkbox - a repeat is single-day only */}
            {!isRepeating && (
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
            )}

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
                          clearClashes();
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

            {/* Repeat - single-day bookings only */}
            {!watchIsMultiDay && (
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="repeat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Repeat
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          clearClashes();
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12 px-4 text-base rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Doesn&apos;t repeat</SelectItem>
                          {(["weekly", "fortnightly", "monthly"] as const).map((frequency) => (
                            <SelectItem key={frequency} value={frequency}>
                              {watchStartDate
                                ? describeRepeat(watchStartDate, frequency)
                                : { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly" }[
                                    frequency
                                  ]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {isRepeating && (
                  <FormField
                    control={form.control}
                    name="repeatUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Until
                        </FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={(val) => {
                              field.onChange(val);
                              clearClashes();
                            }}
                            min={
                              watchStartDate
                                ? addDays(watchStartDate, 1)
                                : format(new Date(), "yyyy-MM-dd")
                            }
                            max={watchStartDate ? addDays(watchStartDate, MAX_SERIES_DAYS) : undefined}
                            placeholder="Select last date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {repeatDates && (
                  <p className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Repeat className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>
                      {repeatDates.length} bookings,{" "}
                      {formatSummaryDate(repeatDates[0])} to{" "}
                      {formatSummaryDate(repeatDates[repeatDates.length - 1])}.
                      {!willAutoApprove && " An approver reviews them together."}
                    </span>
                  </p>
                )}
              </div>
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
                    <Check className="h-4 w-4 flex-shrink-0" />
                    <span>No existing bookings, this resource is free on the selected date{watchIsMultiDay || repeatDates ? "s" : ""}.</span>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-amber-800 dark:text-amber-200 mb-1.5">
                      Already booked during this period:
                    </p>
                    <ul className="space-y-1 text-amber-700 dark:text-amber-300">
                      {existingBookingsForDate.map((b) => (
                        <li key={b._id} className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 flex-shrink-0" />
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
                            clearClashes();
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
                            clearClashes();
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

            {/* Some dates of a repeat are taken - book around them, or change it */}
            {seriesClash && (
              <SeriesClashBanner
                clash={seriesClash}
                submitting={isSubmitting}
                onBookTheRest={form.handleSubmit((values) => submit(values, true))}
                onDismiss={() => setSeriesClash(null)}
              />
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
              <User className="h-4 w-4 text-gray-500" />
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Book on behalf of (optional)
              </span>
            </div>

            <Combobox
              options={onBehalfOptions}
              value={onBehalfOf}
              onValueChange={(v) => setOnBehalfOf(v as Id<"users"> | "__blocked__" | null)}
              placeholder="Search for a member..."
              emptyText="No members found."
              clearable
              showClearButton
              listPosition="above"
            />

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              As an approver, you can create bookings for other members. These will be auto-approved.
            </p>
          </div>
        )}

      </form>
    </Form>
  );

  const formFooter = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          if (guard.requestClose()) onClose();
        }}
              >
        Cancel
      </Button>
      <Button
        type="submit"
        form="booking-form"
        disabled={isSubmitting}
        className="bg-red-700 hover:bg-red-800"
      >
        {isSubmitting ? "Submitting..." : "Submit Request"}
      </Button>
    </>
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

      <ConfirmDialog
        tone="destructive"
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
        <CircleX className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
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

function SeriesClashBanner({
  clash,
  submitting,
  onBookTheRest,
  onDismiss,
}: {
  clash: { clashDates: string[]; total: number };
  submitting: boolean;
  onBookTheRest: () => void;
  onDismiss: () => void;
}) {
  const free = clash.total - clash.clashDates.length;
  return (
    <div
      role="alert"
      className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
    >
      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
        {clash.clashDates.length} of {clash.total} dates are already booked
      </p>
      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
        {clash.clashDates.map(formatSummaryDate).join(", ")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={submitting}
          onClick={onBookTheRest}
          className="bg-red-700 hover:bg-red-800"
        >
          Book the other {free} {free === 1 ? "date" : "dates"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
          Change it
        </Button>
      </div>
    </div>
  );
}
