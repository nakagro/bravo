import { useEffect } from "react";
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
import { useDirtyDraftGuard } from "@/hooks/useDirtyDraftGuard";
import { DeleteConfirmDialog } from "../../../components/shared/DeleteConfirmDialog";
import { DatePicker } from "../../../components/shared/DatePicker";
import { formatUserName, getBookingConflictMessage } from "../types";
import { useIsMobile } from "@/hooks/use-mobile";
import { Trash2, User } from "lucide-react";

const bookingEditSchema = z
  .object({
    resourceId: z.string().min(1, "Please select a resource"),
    status: z.enum(["pending", "approved", "rejected", "cancelled"]),
    startDate: z.string().min(1, "Please select a date"),
    endDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    isAllDay: z.boolean(),
    isMultiDay: z.boolean(),
    notes: z.string(),
  })
  .refine(
    (data) => !data.isMultiDay || data.endDate.length > 0,
    { message: "Please select an end date", path: ["endDate"] }
  )
  .refine(
    (data) => data.isAllDay || (data.startTime.length > 0 && data.endTime.length > 0),
    { message: "Please select start and end times", path: ["startTime"] }
  )
  .refine(
    (data) => data.isAllDay || data.isMultiDay || !data.startTime || !data.endTime || data.startTime < data.endTime,
    { message: "End time must be after start time", path: ["endTime"] }
  );

type BookingEditValues = z.infer<typeof bookingEditSchema>;

interface BookingEditFormProps {
  bookingId: Id<"bookings">;
  onClose: () => void;
}

export function BookingEditForm({ bookingId, onClose }: BookingEditFormProps) {
  const isMobile = useIsMobile();
  const activeResources = useQuery(api.bookings.getActiveBookingResources);
  const existingBooking = useQuery(api.bookings.getBooking, { bookingId });
  const updateBooking = useMutation(api.bookings.updateBooking);

  const form = useForm<BookingEditValues>({
    resolver: zodResolver(bookingEditSchema),
    defaultValues: {
      resourceId: "",
      status: "pending",
      startDate: "",
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
  const watchIsAllDay = form.watch("isAllDay");
  const watchIsMultiDay = form.watch("isMultiDay");
  const watchStatus = form.watch("status");

  // Load existing booking data
  useEffect(() => {
    if (existingBooking) {
      form.reset({
        resourceId: existingBooking.resourceId,
        status: existingBooking.status,
        startDate: existingBooking.startDate,
        endDate: existingBooking.endDate || "",
        startTime: existingBooking.startTime || "",
        endTime: existingBooking.endTime || "",
        isAllDay: existingBooking.isAllDay,
        isMultiDay:
          !!existingBooking.endDate && existingBooking.endDate !== existingBooking.startDate,
        notes: existingBooking.notes || "",
      });
    }
  }, [existingBooking, form]);

  const onSubmit = async (values: BookingEditValues) => {
    try {
      await updateBooking({
        bookingId,
        resourceId: values.resourceId as Id<"bookingResources">,
        startDate: values.startDate,
        endDate: values.isMultiDay ? values.endDate : "",
        startTime: values.isAllDay ? "" : values.startTime,
        endTime: values.isAllDay ? "" : values.endTime,
        isAllDay: values.isAllDay,
        notes: values.notes.trim(),
        status: values.status,
      });
      guard.release();
      toast.success("Booking updated successfully");
      onClose();
    } catch (error) {
      console.error("Error updating booking:", error);
      const conflictMessage = getBookingConflictMessage(error);
      toast.error(conflictMessage ? "Booking conflict" : "Failed to update booking", {
        description:
          conflictMessage ??
          (error instanceof Error ? error.message : "An unexpected error occurred."),
      });
    }
  };

  const handleDelete = async () => {
    try {
      await updateBooking({ bookingId, status: "cancelled" });
      guard.release();
      toast.success("Booking cancelled");
      onClose();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  if (!existingBooking) return null;

  const formContent = (
    <Form {...form}>
      <form id="booking-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Requester Info */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <User className="h-5 w-5 text-gray-500" />
          <div>
            <div className="text-sm font-medium">
              Requested by {formatUserName(existingBooking.requestedByUser)}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(existingBooking.createdAt).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>

        {/* Status */}
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-12 px-4 text-base rounded-lg">
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Resource Selection */}
        <FormField
          control={form.control}
          name="resourceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Resource
              </FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-12 px-4 text-base rounded-lg">
                    <SelectValue placeholder="Select a resource..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {activeResources?.map((resource) => (
                    <SelectItem key={resource._id} value={resource._id}>
                      {resource.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date Selection */}
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
                  onChange={field.onChange}
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
                  onChange={field.onChange}
                  min={form.getValues("startDate")}
                  placeholder="Select end date"
                />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Reason for booking
              </FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  rows={3}
                  placeholder="e.g., Training exercise, Community event..."
                  className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Cancel Booking */}
        {watchStatus !== "cancelled" && (
          <DeleteConfirmDialog
            title="Cancel this booking?"
            description={`This will cancel the booking for ${existingBooking.resource?.name}. This action cannot be undone.`}
            confirmLabel="Cancel Booking"
            destructive
            onConfirm={handleDelete}
            trigger={
              <button
                type="button"
                className="w-full py-3 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="h-5 w-5" />
                Cancel Booking
              </button>
            }
          />
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
        form="booking-edit-form"
        disabled={isSubmitting}
        className="bg-red-700 hover:bg-red-800"
      >
        {isSubmitting ? "Saving..." : "Save Changes"}
      </Button>
    </>
  );

  return (
    <>
      <ResponsiveModal
        open
        onClose={onClose}
        onRequestClose={guard.requestClose}
        title="Edit Booking"
        footer={formFooter}
        drawerHeight="h-[95vh]"
      >
        {formContent}
      </ResponsiveModal>

      <DeleteConfirmDialog
        open={guard.promptOpen}
        onOpenChange={guard.setPromptOpen}
        title="Discard unsaved changes?"
        description="This booking has unsaved edits. Leaving now will lose them."
        confirmLabel="Discard"
        onConfirm={guard.confirmDiscard}
      />
    </>
  );
}
