import { useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ArrowUp, ArrowDown, X } from "lucide-react";
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
import { MemberCombobox, type MemberOption } from "@/components/shared/MemberCombobox";
import { ResponsiveModal } from "../../../components/shared/ResponsiveModal";
import { DatePicker } from "../../../components/shared/DatePicker";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDirtyDraftGuard } from "@/hooks/useDirtyDraftGuard";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { eventTypeColors } from "../types";
import { CrewAppliancesField } from "./CrewAppliancesField";

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
    // Edit mode only; the creator is the organiser of a brand new event
    organiserId: z.string(),
    // Members who can run this one event without brigade-wide Events Admin
    teamLeaderIds: z.array(z.string()),
    location: z.string(),
    address: z.string(),
    startDate: z.string().min(1, "Please select a date"),
    endDate: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    respondBy: z.string(),
    isAllDay: z.boolean(),
    isMultiDay: z.boolean(),
    hasShifts: z.boolean(),
    // Social events (the annual dinner): members say how many they're bringing
    allowsGuests: z.boolean(),
    attendanceNotNeeded: z.boolean(),
    // Blank = no limit, which is the default
    maxGuestsPerMember: z.string(),
    collectsDietary: z.boolean(),
    // Create-time only. Afterwards the mode is flipped from the event page,
    // which can offer to carry existing responses onto the roster.
    responsesClosed: z.boolean(),
    slots: z.array(slotSchema),
    // Appliances the event needs crewed; the seats are filled on the event page
    needsCrew: z.boolean(),
    crewAppliances: z.array(z.string()),
    description: z.string(),
  })
  .refine(
    (data) =>
      !data.allowsGuests ||
      data.maxGuestsPerMember === "" ||
      (/^\d+$/.test(data.maxGuestsPerMember) &&
        Number(data.maxGuestsPerMember) >= 1 &&
        Number(data.maxGuestsPerMember) <= 50),
    { message: "Guest limit must be a whole number from 1 to 50", path: ["maxGuestsPerMember"] }
  )
  .refine((data) => !data.needsCrew || data.crewAppliances.length > 0, {
    message: "Pick at least one appliance, or turn this off",
    path: ["crewAppliances"],
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
  organiserId: "",
  teamLeaderIds: [],
  location: "",
  address: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  respondBy: "",
  // Brigade events are typically timed (e.g. a 9–2 sausage sizzle)
  isAllDay: false,
  isMultiDay: false,
  hasShifts: false,
  allowsGuests: false,
  attendanceNotNeeded: false,
  maxGuestsPerMember: "",
  collectsDietary: false,
  responsesClosed: false,
  slots: [],
  needsCrew: false,
  crewAppliances: [],
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
  /**
   * Called after an edit that changed the date, time or location of an active
   * event, so the page can offer the "Changed: …" notice. Saving never notifies.
   */
  onDetailsChanged?: (eventId: Id<"events">) => void;
}

export function EventForm({ eventId, onClose, onDetailsChanged }: EventFormProps) {
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
  const existingCrews = useQuery(
    api.eventCrews.listEventCrews,
    eventId ? { eventId } : "skip"
  );
  const savedCrewNames = useMemo(
    () => (existingCrews ?? []).map((crew) => crew.applianceName),
    [existingCrews]
  );
  // Appliances with someone already seated - dropping one loses its crew
  const crewedNames = useMemo(
    () =>
      new Set(
        (existingCrews ?? [])
          .filter((crew) => crew.crewLeader || crew.driver || crew.crewMembers.length > 0)
          .map((crew) => crew.applianceName.trim().toLowerCase())
      ),
    [existingCrews]
  );
  const createEvent = useMutation(api.events.createEvent);
  const updateEvent = useMutation(api.events.updateEvent);
  const changeOrganiser = useMutation(api.events.changeOrganiser);
  const setTeamLeaders = useMutation(api.events.setTeamLeaders);
  // Populates the hand-over picker and the team-leader picker
  const members = useQuery(api.users.getMemberUsers);
  const memberOptions: MemberOption[] = useMemo(
    () =>
      (members ?? [])
        .map((member) => ({
          _id: member._id,
          name:
            [member.firstName, member.lastName].filter(Boolean).join(" ") ||
            member.name ||
            member.email ||
            "Unnamed member",
          rank: member.rank,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  const isEditing = eventId !== null;
  // Naming team leaders belongs to the organiser and Events Admin, not to team
  // leaders themselves. A brand new event belongs to whoever is creating it.
  const canAppointLeaders = !isEditing || existingEvent?.canAppointLeaders === true;

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

  const { isSubmitting, isDirty } = form.formState;
  // One confirmation for every exit from a half-typed event: the X, Cancel,
  // Escape, an outside tap, the drawer swipe and the Back button.
  const guard = useDirtyDraftGuard(isDirty, () => {
    // An explicit discard takes the stashed new-event draft with it, otherwise
    // reopening the form would resurrect what was just thrown away.
    if (!isEditing) newEventDraft = null;
    onClose();
  });
  const watchIsAllDay = form.watch("isAllDay");
  const watchIsMultiDay = form.watch("isMultiDay");
  const watchHasShifts = form.watch("hasShifts");
  const watchAllowsGuests = form.watch("allowsGuests");
  const watchNeedsCrew = form.watch("needsCrew");

  // Load existing event data when editing (wait for slots and crews too, so
  // everything is populated in the same reset)
  useEffect(() => {
    if (existingEvent && existingSlots !== undefined && existingCrews !== undefined) {
      form.reset({
        title: existingEvent.title,
        eventTypeId: existingEvent.eventTypeId || "",
        organiserId: existingEvent.createdBy,
        teamLeaderIds: existingEvent.teamLeaderIds ?? [],
        location: existingEvent.location || "",
        address: existingEvent.address || "",
        startDate: existingEvent.startDate,
        endDate: existingEvent.endDate || "",
        startTime: existingEvent.startTime || "",
        endTime: existingEvent.endTime || "",
        respondBy: existingEvent.respondBy || "",
        isAllDay: existingEvent.isAllDay,
        isMultiDay:
          !!existingEvent.endDate && existingEvent.endDate !== existingEvent.startDate,
        hasShifts: existingEvent.hasShifts ?? false,
        allowsGuests: existingEvent.allowsGuests ?? false,
        attendanceNotNeeded: existingEvent.attendanceNotNeeded ?? false,
        maxGuestsPerMember:
          existingEvent.maxGuestsPerMember != null
            ? String(existingEvent.maxGuestsPerMember)
            : "",
        collectsDietary: existingEvent.collectsDietary ?? false,
        responsesClosed: existingEvent.memberResponses === "closed",
        slots: existingSlots.map((slot) => ({
          _id: slot._id,
          label: slot.label,
          startTime: slot.startTime || "",
          endTime: slot.endTime || "",
          date: slot.date || "",
          targetCount: slot.targetCount != null ? String(slot.targetCount) : "",
        })),
        needsCrew: existingCrews.length > 0,
        crewAppliances: existingCrews.map((crew) => crew.applianceName),
        description: existingEvent.description || "",
      });
    }
  }, [existingEvent, existingSlots, existingCrews, form]);

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
      address: values.address.trim(),
      startDate: values.startDate,
      endDate: values.isMultiDay ? values.endDate : "",
      startTime: values.isAllDay ? "" : values.startTime,
      endTime: values.isAllDay ? "" : values.endTime,
      respondBy: values.respondBy,
      isAllDay: values.isAllDay,
      description: values.description.trim(),
    };

    // Guests belong to shiftless events only; shifts win if both are somehow set
    const guestFields = {
      allowsGuests: !values.hasShifts && values.allowsGuests,
      collectsDietary: !values.hasShifts && values.allowsGuests && values.collectsDietary,
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

    const crewAppliances = values.needsCrew ? values.crewAppliances : [];
    // Only reconcile when the list actually changed, so an appliance someone
    // added from the event page while this form was open isn't swept away.
    const sameNames = (a: string[], b: string[]) =>
      a.length === b.length &&
      a.every((name) => b.some((other) => other.trim().toLowerCase() === name.trim().toLowerCase()));
    const crewChanged = !sameNames(crewAppliances, savedCrewNames);

    try {
      if (isEditing && eventId) {
        // Hand-over is its own mutation (own permission rule, own audit entry),
        // so it goes before the field save; if it fails, nothing else is written.
        if (values.organiserId && values.organiserId !== existingEvent?.createdBy) {
          await changeOrganiser({
            eventId,
            organiserId: values.organiserId as Id<"users">,
          });
        }
        // Same reasoning as the hand-over: its own mutation, its own audit
        // entry. Runs after the organiser change so the server sees the final
        // organiser when it drops them from their own leader list.
        if (canAppointLeaders) {
          await setTeamLeaders({ eventId, userIds: values.teamLeaderIds as Id<"users">[] });
        }
        await updateEvent({
          eventId,
          ...fields,
          // "" clears the category; otherwise it's an eventTypes Id
          eventTypeId: fields.eventTypeId as "" | Id<"eventTypes">,
          hasShifts: values.hasShifts,
          ...guestFields,
          // Only sent when changed, so an untouched edit can't drop a confirmed list
          attendanceNotNeeded:
            values.attendanceNotNeeded !== (existingEvent?.attendanceNotNeeded ?? false)
              ? values.attendanceNotNeeded
              : undefined,
          // "" clears the cap back to unlimited
          maxGuestsPerMember: guestFields.allowsGuests
            ? values.maxGuestsPerMember
              ? Number(values.maxGuestsPerMember)
              : ("" as const)
            : ("" as const),
          slots,
          crewAppliances: crewChanged ? crewAppliances : undefined,
        });
        guard.release();
        toast.success("Event updated");
        if (existingEvent && existingEvent.status === "active" && onDetailsChanged) {
          const was = existingEvent as Record<string, unknown>;
          const now = fields as Record<string, unknown>;
          const moved = (["startDate", "endDate", "startTime", "endTime", "location", "address"] as const).some(
            (key) => ((now[key] as string) || undefined) !== ((was[key] as string) || undefined)
          );
          if (moved || fields.isAllDay !== existingEvent.isAllDay) onDetailsChanged(eventId);
        }
      } else {
        const newEventId = await createEvent({
          ...fields,
          eventTypeId: (fields.eventTypeId || undefined) as Id<"eventTypes"> | undefined,
          location: fields.location || undefined,
          address: fields.address || undefined,
          endDate: fields.endDate || undefined,
          startTime: fields.startTime || undefined,
          endTime: fields.endTime || undefined,
          respondBy: fields.respondBy || undefined,
          description: fields.description || undefined,
          hasShifts: values.hasShifts,
          ...guestFields,
          attendanceNotNeeded: values.attendanceNotNeeded || undefined,
          maxGuestsPerMember:
            guestFields.allowsGuests && values.maxGuestsPerMember
              ? Number(values.maxGuestsPerMember)
              : undefined,
          // Only ever set at creation here - changing it later goes through
          // setMemberResponses so the carry-over can be offered.
          memberResponses: values.responsesClosed ? ("closed" as const) : undefined,
          slots: values.hasShifts ? slots : undefined,
          crewAppliances: crewAppliances.length > 0 ? crewAppliances : undefined,
        });
        if (values.teamLeaderIds.length > 0) {
          await setTeamLeaders({
            eventId: newEventId,
            userIds: values.teamLeaderIds as Id<"users">[],
          });
        }
        // Event saved - the draft has served its purpose.
        newEventDraft = null;
        guard.release();
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

        {/* Organiser. Edit only: a new event belongs to whoever creates it. */}
        {isEditing && (
          <FormField
            control={form.control}
            name="organiserId"
            render={({ field }) => (
              <FormItem>
                <MemberCombobox
                  label="Organiser"
                  options={memberOptions}
                  value={(field.value || null) as Id<"users"> | null}
                  // An event always has an organiser, so there is no clear option.
                  clearable={false}
                  onChange={(value) => value && field.onChange(value)}
                  placeholder="Search for a member"
                  helperText="Hands the event over. The new organiser can edit it and gets the responses to manage."
                />
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Team leaders. The one place per-event authority is granted: named
            members get the organiser's toolkit for this event only. */}
        {canAppointLeaders && (
          <FormField
            control={form.control}
            name="teamLeaderIds"
            render={({ field }) => {
              const selected = field.value as string[];
              const organiserId = form.watch("organiserId");
              return (
                <FormItem>
                  <MemberCombobox
                    label="Team leaders"
                    options={memberOptions.filter(
                      (option) => !selected.includes(option._id) && option._id !== organiserId
                    )}
                    // Always empty: this picker adds to the list below rather
                    // than holding a single selection.
                    value={null}
                    onChange={(value) => value && field.onChange([...selected, value])}
                    placeholder="Add a member"
                    helperText="Team leaders can edit this event, allocate shifts, open or close responses, notify members and see the full responses - for this event only. No Events Admin access anywhere else."
                  />
                  {selected.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selected.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-sm bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                        >
                          {memberOptions.find((option) => option._id === id)?.name ??
                            "Unknown member"}
                          <button
                            type="button"
                            onClick={() =>
                              field.onChange(selected.filter((value) => value !== id))
                            }
                            aria-label="Remove team leader"
                            className="p-0.5 rounded-full hover:bg-amber-200/60 dark:hover:bg-amber-800/60"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        )}

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

        {/* Address */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Address (optional)
              </FormLabel>
              <FormControl>
                <input
                  {...field}
                  type="text"
                  placeholder="e.g., 12 Smith St, Wandong"
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

        {/* Guests (+1s) - shiftless events only. A shift roster is operational;
            a slot pick has no partner attached to it. */}
        {!watchHasShifts && (
          <>
            <FormField
              control={form.control}
              name="allowsGuests"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg cursor-pointer">
                    <span>
                      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Members can bring guests
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        Adds a &quot;+1&quot; count to the RSVP, so you get a real headcount
                      </span>
                    </span>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Members can bring guests"
                        className="h-7 w-12 [&>span]:h-6 [&>span]:w-6 [&>span]:data-[state=checked]:translate-x-5"
                      />
                    </FormControl>
                  </label>
                </FormItem>
              )}
            />

            {watchAllowsGuests && (
              <div className="space-y-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
                <FormField
                  control={form.control}
                  name="maxGuestsPerMember"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Max guests per member
                      </FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          type="number"
                          min={1}
                          max={50}
                          inputMode="numeric"
                          placeholder="No limit"
                          className={inputClasses}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Leave blank for no limit. Lowering it later won&apos;t change answers
                        members have already given.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="collectsDietary"
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg cursor-pointer">
                        <span>
                          <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Ask for dietary requirements
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            One note per member, covering them and their guests. Only you and
                            the event&apos;s team leaders can read them.
                          </span>
                        </span>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label="Ask for dietary requirements"
                            className="h-7 w-12 [&>span]:h-6 [&>span]:w-6 [&>span]:data-[state=checked]:translate-x-5"
                          />
                        </FormControl>
                      </label>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </>
        )}

        {/* Responses mode - create only. On an existing event this is flipped
            from the event page, where closing can offer to carry the people who
            already said yes straight onto the roster. */}
        {!isEditing && (
          <FormField
            control={form.control}
            name="responsesClosed"
            render={({ field }) => (
              <FormItem>
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg cursor-pointer">
                  <span>
                    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      I already know who&apos;s going
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Skips asking the brigade - you set the roster yourself. You can
                      open it up later.
                    </span>
                  </span>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="I already know who's going"
                      className="h-7 w-12 [&>span]:h-6 [&>span]:w-6 [&>span]:data-[state=checked]:translate-x-5"
                    />
                  </FormControl>
                </label>
              </FormItem>
            )}
          />
        )}

        {/* Off once a list has been confirmed - switching it on would drop the
            list, and that's a decision for the event page, not a form toggle. */}
        <FormField
          control={form.control}
          name="attendanceNotNeeded"
          render={({ field }) => {
            const confirmed = existingEvent?.attendanceConfirmedAt !== undefined;
            return (
              <FormItem>
                <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg cursor-pointer">
                  <span>
                    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      No attendance record needed
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {confirmed
                        ? "Attendance has already been confirmed for this event."
                        : "Skips confirming who attended once the event is over."}
                    </span>
                  </span>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={confirmed}
                      aria-label="No attendance record needed"
                      className="h-7 w-12 [&>span]:h-6 [&>span]:w-6 [&>span]:data-[state=checked]:translate-x-5"
                    />
                  </FormControl>
                </label>
              </FormItem>
            );
          }}
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

                <div className="space-y-1">
                  <label
                    htmlFor={`slot-${slotField.id}-label`}
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Label
                  </label>
                  <input
                    {...form.register(`slots.${index}.label`)}
                    id={`slot-${slotField.id}-label`}
                    type="text"
                    placeholder="e.g. Morning shift"
                    className={inputClasses}
                  />
                </div>

                {/* Native time inputs are intrinsically wide; side by side they
                    collide on a phone, so stack them there. */}
                <div className={isMobile ? "space-y-3" : "grid grid-cols-2 gap-3"}>
                  <div className="space-y-1">
                    <label
                      htmlFor={`slot-${slotField.id}-start`}
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      From
                    </label>
                    <input
                      {...form.register(`slots.${index}.startTime`)}
                      id={`slot-${slotField.id}-start`}
                      type="time"
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor={`slot-${slotField.id}-end`}
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      To
                    </label>
                    <input
                      {...form.register(`slots.${index}.endTime`)}
                      id={`slot-${slotField.id}-end`}
                      type="time"
                      className={inputClasses}
                    />
                  </div>
                </div>

                <div className={isMobile ? "space-y-3" : "grid grid-cols-2 gap-3"}>
                  <div className="space-y-1">
                    <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Date (optional)
                    </span>
                    <FormField
                      control={form.control}
                      name={`slots.${index}.date`}
                      render={({ field }) => (
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Same as event"
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor={`slot-${slotField.id}-target`}
                      className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Target # (optional)
                    </label>
                    <input
                      {...form.register(`slots.${index}.targetCount`)}
                      id={`slot-${slotField.id}-target`}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder="e.g. 4"
                      className={inputClasses}
                    />
                  </div>
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

        {/* Appliance crewing - which trucks the event needs. Independent of
            shifts and the roster: a seat on a truck is its own thing. */}
        <FormField
          control={form.control}
          name="needsCrew"
          render={({ field }) => (
            <FormItem>
              <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg cursor-pointer">
                <span>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Needs an appliance crewed
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    A truck at the event, with a crew leader, driver and crew
                  </span>
                </span>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Needs an appliance crewed"
                    className="h-7 w-12 [&>span]:h-6 [&>span]:w-6 [&>span]:data-[state=checked]:translate-x-5"
                  />
                </FormControl>
              </label>
            </FormItem>
          )}
        />
        {(watchNeedsCrew || savedCrewNames.length > 0) && (
          <FormField
            control={form.control}
            name="crewAppliances"
            render={({ field }) => (
              <FormItem>
                {watchNeedsCrew ? (
                  <CrewAppliancesField
                    value={field.value}
                    onChange={field.onChange}
                    crewedNames={crewedNames}
                    savedNames={savedCrewNames}
                  />
                ) : crewedNames.size > 0 ? (
                  // Switched off on an event that has crew: say what saving does
                  <p className="px-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Saving removes every appliance from this event, and the crew already on them.
                  </p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />
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
        form="event-form"
        disabled={isSubmitting}
        className="bg-red-700 hover:bg-red-800"
      >
        {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Event"}
      </Button>
    </>
  );

  return (
    <>
      <ResponsiveModal
        open
        onClose={onClose}
        onRequestClose={guard.requestClose}
        title={isEditing ? "Edit Event" : "New Event"}
        footer={formFooter}
        drawerHeight="h-[95vh]"
      >
        {formContent}
      </ResponsiveModal>

      <DeleteConfirmDialog
        open={guard.promptOpen}
        onOpenChange={guard.setPromptOpen}
        title="Discard unsaved changes?"
        description={
          isEditing
            ? "This event has unsaved edits. Leaving now will lose them."
            : "This event hasn't been created yet. Leaving now will lose what you've entered."
        }
        confirmLabel="Discard"
        onConfirm={guard.confirmDiscard}
      />
    </>
  );
}
