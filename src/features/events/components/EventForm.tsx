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
import { ResponsiveModal } from "../../../components/shared/ResponsiveModal";
import { DatePicker } from "../../../components/shared/DatePicker";
import { useIsMobile } from "@/hooks/use-mobile";

const eventFormSchema = z
  .object({
    title: z.string().min(1, "Please enter a title"),
    eventType: z.string(),
    location: z.string(),
    startDate: z.string().min(1, "Please select a date"),
    endDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    isAllDay: z.boolean(),
    isMultiDay: z.boolean(),
    description: z.string(),
  })
  .refine(
    (data) => !data.isMultiDay || data.endDate.length > 0,
    { message: "Please select an end date", path: ["endDate"] }
  )
  .refine(
    (data) => data.isAllDay || data.startTime.length > 0,
    { message: "Please select a start time", path: ["startTime"] }
  )
  .refine(
    (data) => data.isAllDay || data.isMultiDay || !data.startTime || !data.endTime || data.startTime < data.endTime,
    { message: "End time must be after start time", path: ["endTime"] }
  );

type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  /** When set, edits an existing event; otherwise creates a new one */
  eventId: Id<"events"> | null;
  onClose: () => void;
}

export function EventForm({ eventId, onClose }: EventFormProps) {
  const isMobile = useIsMobile();
  const existingEvent = useQuery(
    api.events.getEvent,
    eventId ? { eventId } : "skip"
  );
  const createEvent = useMutation(api.events.createEvent);
  const updateEvent = useMutation(api.events.updateEvent);

  const isEditing = eventId !== null;

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      eventType: "",
      location: "",
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      isAllDay: true,
      isMultiDay: false,
      description: "",
    },
  });

  const { isSubmitting } = form.formState;
  const watchIsAllDay = form.watch("isAllDay");
  const watchIsMultiDay = form.watch("isMultiDay");

  // Load existing event data when editing
  useEffect(() => {
    if (existingEvent) {
      form.reset({
        title: existingEvent.title,
        eventType: existingEvent.eventType || "",
        location: existingEvent.location || "",
        startDate: existingEvent.startDate,
        endDate: existingEvent.endDate || "",
        startTime: existingEvent.startTime || "",
        endTime: existingEvent.endTime || "",
        isAllDay: existingEvent.isAllDay,
        isMultiDay:
          !!existingEvent.endDate && existingEvent.endDate !== existingEvent.startDate,
        description: existingEvent.description || "",
      });
    }
  }, [existingEvent, form]);

  const onSubmit = async (values: EventFormValues) => {
    // Empty strings clear optional fields on the server
    const fields = {
      title: values.title.trim(),
      eventType: values.eventType.trim(),
      location: values.location.trim(),
      startDate: values.startDate,
      endDate: values.isMultiDay ? values.endDate : "",
      startTime: values.isAllDay ? "" : values.startTime,
      endTime: values.isAllDay ? "" : values.endTime,
      isAllDay: values.isAllDay,
      description: values.description.trim(),
    };

    try {
      if (isEditing && eventId) {
        await updateEvent({ eventId, ...fields });
        toast.success("Event updated");
      } else {
        await createEvent({
          ...fields,
          eventType: fields.eventType || undefined,
          location: fields.location || undefined,
          endDate: fields.endDate || undefined,
          startTime: fields.startTime || undefined,
          endTime: fields.endTime || undefined,
          description: fields.description || undefined,
        });
        toast.success("Event created");
      }
      onClose();
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error(isEditing ? "Failed to update event" : "Failed to create event", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  // Wait for the existing event to load before showing the edit form
  if (isEditing && !existingEvent) return null;

  const inputClasses =
    "w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500";

  const formContent = (
    <Form {...form}>
      <form id="event-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Title
              </FormLabel>
              <FormControl>
                <input
                  {...field}
                  type="text"
                  placeholder="e.g., Sausage sizzle at Bunnings"
                  className={inputClasses}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Event Type */}
        <FormField
          control={form.control}
          name="eventType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Type (optional)
              </FormLabel>
              <FormControl>
                <input
                  {...field}
                  type="text"
                  placeholder="e.g., Fundraiser, Training, Community"
                  className={inputClasses}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Location */}
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Location (optional)
              </FormLabel>
              <FormControl>
                <input
                  {...field}
                  type="text"
                  placeholder="e.g., Main Station"
                  className={inputClasses}
                />
              </FormControl>
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
                    <input {...field} type="time" className={inputClasses} />
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
                    <input {...field} type="time" className={inputClasses} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Description (optional)
              </FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  rows={3}
                  placeholder="What members need to know — what to bring, where to meet..."
                  className={inputClasses}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );

  const formFooter = (
    <div className="flex gap-3 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] md:pb-4 border-t border-gray-200 dark:border-gray-700 bg-background">
      <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 text-base">
        Cancel
      </Button>
      <Button
        type="submit"
        form="event-form"
        disabled={isSubmitting}
        className="flex-1 h-12 text-base bg-red-700 hover:bg-red-800"
      >
        {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Event"}
      </Button>
    </div>
  );

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title={isEditing ? "Edit Event" : "New Event"}
      footer={formFooter}
      drawerHeight="h-[95vh]"
    >
      {formContent}
    </ResponsiveModal>
  );
}
