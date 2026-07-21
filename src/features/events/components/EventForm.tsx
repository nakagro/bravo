import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
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
import { DatePicker } from "../../../components/shared/DatePicker";
import { useIsMobile } from "@/hooks/use-mobile";
import { eventTypeColors } from "../types";

const slotSchema = z.object({
  _id: z.string().optional(),
  label: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  date: z.string(),
  targetCount: z.string(),
});

const eventFormSchema = z
  .object({
    title: z.string().min(1, "Please enter a title"),
    eventTypeId: z.string(),
    location: z.string(),
    startDate: z.string().min(1, "Please select a date"),
    endDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    respondBy: z.string(),
    isAllDay: z.boolean(),
    isMultiDay: z.boolean(),
    hasShifts: z.boolean(),
    slots: z.array(slotSchema),
    description: z.string(),
  })
  .refine((data) => !data.hasShifts || data.slots.length > 0, {
    message: "Add at least one shift, or turn off shifts",
    path: ["slots"],
  })
  .refine((data) => !data.hasShifts || data.slots.every((s) => s.label.trim().length > 0), {
    message: "Every shift needs a label",
    path: ["slots"],
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

const blankDefaults: EventFormValues = {
  title: "",
  eventTypeId: "",
  location: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  respondBy: "",
  // Brigade events are typically timed (e.g. a 9–2 sausage sizzle)
  isAllDay: false,
  isMultiDay: false,
  hasShifts: false,
  slots: [],
  description: "",
};

// In-memory draft for the *new* event form, kept outside React so it survives an
// accidental modal close. It's intentionally module-scoped: a full page reload
// clears it, an accidental dismissal does not. Cleared once an event is created.
let newEventDraft: EventFormValues | null = null;

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
  const eventTypes = useQuery(api.eventTypes.getEventTypes);
  const existingSlots = useQuery(
    api.events.getEventSlots,
    eventId ? { eventId } : "skip"
  );
  const createEvent = useMutation(api.events.createEvent);
  const updateEvent = useMutation(api.events.updateEvent);

  const isEditing = eventId !== null;

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    // Restore an in-progress new-event draft if one survived a previous close.
    defaultValues: isEditing ? blankDefaults : newEventDraft ?? blankDefaults,
  });

  const {
    fields: slotFields,
    append: appendSlot,
    remove: removeSlot,
    move: moveSlot,
  } = useFieldArray({ control: form.control, name: "slots" });

  const { isSubmitting } = form.formState;
  const watchIsAllDay = form.watch("isAllDay");
  const watchIsMultiDay = form.watch("isMultiDay");
  const watchHasShifts = form.watch("hasShifts");

  // Load existing event data when editing (wait for slots too, so the field
  // array is populated in the same reset)
  useEffect(() => {
    if (existingEvent && existingSlots !== undefined) {
      form.reset({
        title: existingEvent.title,
        eventTypeId: existingEvent.eventTypeId || "",
        location: existingEvent.location || "",
        startDate: existingEvent.startDate,
        endDate: existingEvent.endDate || "",
        startTime: existingEvent.startTime || "",
        endTime: existingEvent.endTime || "",
        respondBy: existingEvent.respondBy || "",
        isAllDay: existingEvent.isAllDay,
        isMultiDay:
          !!existingEvent.endDate && existingEvent.endDate !== existingEvent.startDate,
        hasShifts: existingEvent.hasShifts ?? false,
        slots: existingSlots.map((slot) => ({
          _id: slot._id,
          label: slot.label,
          startTime: slot.startTime || "",
          endTime: slot.endTime || "",
          date: slot.date || "",
          targetCount: slot.targetCount != null ? String(slot.targetCount) : "",
        })),
        description: existingEvent.description || "",
      });
    }
  }, [existingEvent, existingSlots, form]);

  // Persist the new-event draft on every change so an accidental close doesn't
  // lose progress. Editing an existing event doesn't touch the draft.
  useEffect(() => {
    if (isEditing) return;
    const sub = form.watch((values) => {
      newEventDraft = values as EventFormValues;
    });
    return () => sub.unsubscribe();
  }, [form, isEditing]);

  const onSubmit = async (values: EventFormValues) => {
    // Empty strings clear optional fields on the server
    const fields = {
      title: values.title.trim(),
      eventTypeId: values.eventTypeId,
      location: values.location.trim(),
      startDate: values.startDate,
      endDate: values.isMultiDay ? values.endDate : "",
      startTime: values.isAllDay ? "" : values.startTime,
      endTime: values.isAllDay ? "" : values.endTime,
      respondBy: values.respondBy,
      isAllDay: values.isAllDay,
      description: values.description.trim(),
    };

    // Slots only matter when shifts are on; an empty list on update clears them
    const slots = values.hasShifts
      ? values.slots.map((slot) => ({
          _id: (slot._id || undefined) as Id<"eventSlots"> | undefined,
          label: slot.label.trim(),
          startTime: slot.startTime || undefined,
          endTime: slot.endTime || undefined,
          date: slot.date || undefined,
          targetCount: slot.targetCount ? Number(slot.targetCount) : undefined,
        }))
      : [];

    try {
      if (isEditing && eventId) {
        await updateEvent({
          eventId,
          ...fields,
          // "" clears the category; otherwise it's an eventTypes Id
          eventTypeId: fields.eventTypeId as "" | Id<"eventTypes">,
          hasShifts: values.hasShifts,
          slots,
        });
        toast.success("Event updated");
      } else {
        await createEvent({
          ...fields,
          eventTypeId: (fields.eventTypeId || undefined) as Id<"eventTypes"> | undefined,
          location: fields.location || undefined,
          endDate: fields.endDate || undefined,
          startTime: fields.startTime || undefined,
          endTime: fields.endTime || undefined,
          respondBy: fields.respondBy || undefined,
          description: fields.description || undefined,
          hasShifts: values.hasShifts,
          slots: values.hasShifts ? slots : undefined,
        });
        // Event saved — the draft has served its purpose.
        newEventDraft = null;
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

  // min-w-0 lets inputs shrink inside grid/flex columns; without it, iOS's
  // intrinsically-wide native time inputs force the whole form to scroll sideways.
  const inputClasses =
    "w-full min-w-0 px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500";

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
          name="eventTypeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Type (optional)
              </FormLabel>
              <FormControl>
                <Select
                  value={field.value || "none"}
                  onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                >
                  <SelectTrigger className="w-full h-auto px-4 py-3 text-base">
                    <SelectValue placeholder="No type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No type</SelectItem>
                    {eventTypes?.map((type) => (
                      <SelectItem key={type._id} value={type._id}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`h-3 w-3 rounded-full ${
                              eventTypeColors[type.color]?.swatch ?? "bg-gray-400"
                            }`}
                          />
                          {type.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              {eventTypes && eventTypes.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No types set up yet. Add them from the Admin tab.
                </p>
              )}
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

        {/* Respond-by date (optional) */}
        <FormField
          control={form.control}
          name="respondBy"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Respond by (optional)
              </FormLabel>
              <FormControl>
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="No deadline"
                />
              </FormControl>
              {field.value && (
                <button
                  type="button"
                  onClick={() => field.onChange("")}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  Clear deadline
                </button>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Shifts / sessions toggle */}
        <FormField
          control={form.control}
          name="hasShifts"
          render={({ field }) => (
            <FormItem>
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg cursor-pointer">
                <span>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Has shifts / sessions
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    Members sign up for specific shifts instead of a simple yes/no
                  </span>
                </span>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      // Seed an empty shift so the editor isn't blank
                      if (checked && slotFields.length === 0) {
                        appendSlot({
                          label: "",
                          startTime: "",
                          endTime: "",
                          date: "",
                          targetCount: "",
                        });
                      }
                    }}
                    aria-label="Has shifts"
                    className="h-7 w-12 [&>span]:h-6 [&>span]:w-6 [&>span]:data-[state=checked]:translate-x-5"
                  />
                </FormControl>
              </label>
            </FormItem>
          )}
        />

        {/* Slots editor */}
        {watchHasShifts && (
          <div className="space-y-3">
            {slotFields.map((slotField, index) => (
              <div
                key={slotField.id}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3 bg-white dark:bg-gray-800"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Shift {index + 1}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveSlot(index, index - 1)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      aria-label="Move shift up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlot(index, index + 1)}
                      disabled={index === slotFields.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      aria-label="Move shift down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSlot(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      aria-label="Remove shift"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <input
                  {...form.register(`slots.${index}.label`)}
                  type="text"
                  placeholder="Label (e.g. Morning shift)"
                  className={inputClasses}
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    {...form.register(`slots.${index}.startTime`)}
                    type="time"
                    aria-label="Shift start time"
                    className={inputClasses}
                  />
                  <input
                    {...form.register(`slots.${index}.endTime`)}
                    type="time"
                    aria-label="Shift end time"
                    className={inputClasses}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`slots.${index}.date`}
                    render={({ field }) => (
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Date (optional)"
                      />
                    )}
                  />
                  <input
                    {...form.register(`slots.${index}.targetCount`)}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    placeholder="Target #"
                    className={inputClasses}
                  />
                </div>
              </div>
            ))}

            {form.formState.errors.slots?.message && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {form.formState.errors.slots.message}
              </p>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                appendSlot({ label: "", startTime: "", endTime: "", date: "", targetCount: "" })
              }
              className="w-full h-11 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add shift
            </Button>
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
                  placeholder="What members need to know: what to bring, where to meet..."
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
