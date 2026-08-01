import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { addDays, format, parseISO } from "date-fns";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { useDirtyDraftGuard } from "@/hooks/useDirtyDraftGuard";
import type { CalendarEvent } from "../lib/parseIcs";

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Event being edited, or null to create a new one */
  event: CalendarEvent | null;
  /** Prefilled date for new events (usually the selected day) */
  defaultDate: Date;
  /** Called after a successful save so the caller can refetch */
  onSaved: () => void;
}

export function EventFormModal({
  open,
  onClose,
  event,
  defaultDate,
  onSaved,
}: EventFormModalProps) {
  const createEvent = useAction(api.calendarWrite.createEvent);
  const updateEvent = useAction(api.calendarWrite.updateEvent);

  const isMobile = useIsMobile();
  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  // Snapshot of the fields as the modal opened, so dirtiness is a plain compare
  // (there's no react-hook-form here to track it).
  const [baseline, setBaseline] = useState("");

  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.summary);
      setAllDay(event.allDay);
      setDate(format(event.start, "yyyy-MM-dd"));
      // All-day DTEND is exclusive; show the last covered day
      setEndDate(
        format(event.allDay ? addDays(event.end, -1) : event.end, "yyyy-MM-dd"),
      );
      setStartTime(format(event.start, "HH:mm"));
      // An event saved without a finish keeps the field blank
      setEndTime(event.endUnknown ? "" : format(event.end, "HH:mm"));
      setLocation(event.location ?? "");
      setDescription(event.description ?? "");
    } else {
      const day = format(defaultDate, "yyyy-MM-dd");
      setTitle("");
      setAllDay(false);
      setDate(day);
      setEndDate(day);
      setStartTime("18:00");
      setEndTime("19:00");
      setLocation("");
      setDescription("");
    }
  }, [open, event, defaultDate]);

  const snapshot = JSON.stringify({
    title,
    allDay,
    date,
    endDate,
    startTime,
    endTime,
    location,
    description,
  });

  useEffect(() => {
    // Runs after the populate effect above, capturing the opened-with state.
    if (open) setBaseline(snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event, defaultDate]);

  const guard = useDirtyDraftGuard(open && baseline !== "" && snapshot !== baseline, onClose);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Event title is required");
      return;
    }
    if (!date) {
      toast.error("Event date is required");
      return;
    }

    let when;
    if (allDay) {
      const lastDay = endDate && endDate >= date ? endDate : date;
      when = {
        kind: "allDay" as const,
        startDate: date,
        endDateExclusive: format(addDays(parseISO(lastDay), 1), "yyyy-MM-dd"),
      };
    } else {
      const start = new Date(`${date}T${startTime}`);
      if (!startTime) {
        toast.error("Start time is required");
        return;
      }
      // A blank end time is deliberate: the finish isn't known yet
      const end = endTime ? new Date(`${date}T${endTime}`) : null;
      if (end && !(end.getTime() > start.getTime())) {
        toast.error("End time must be after the start time");
        return;
      }
      when = {
        kind: "timed" as const,
        start: start.getTime(),
        end: end?.getTime(),
      };
    }

    setSaving(true);
    try {
      const fields = {
        summary: title.trim(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        when,
      };
      if (event) {
        await updateEvent({ uid: event.uid, ...fields });
        toast.success("Event updated");
      } else {
        await createEvent(fields);
        toast.success("Event added to the calendar");
      }
      guard.release();
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save calendar event:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save the event",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ResponsiveModal
        open={open}
        onClose={onClose}
        onRequestClose={guard.requestClose}
        title={event ? "Edit event" : "New event"}
      >
        <div className="space-y-4 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Training night"
              maxLength={200}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="event-all-day">All day</Label>
            <Switch
              id="event-all-day"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-date">{allDay ? "Start date" : "Date"}</Label>
            <Input
              id="event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {allDay ? (
            <div className="space-y-1.5">
              <Label htmlFor="event-end-date">End date</Label>
              <Input
                id="event-end-date"
                type="date"
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          ) : (
            // Native time inputs are intrinsically wide; side by side they collide
            // on a phone, so stack them there.
            <div className={isMobile ? "space-y-3" : "grid grid-cols-2 gap-3"}>
              <div className="space-y-1.5">
                <Label htmlFor="event-start-time">Starts</Label>
                <Input
                  id="event-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-end-time">Ends (optional)</Label>
                <Input
                  id="event-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank if the finish time isn&apos;t known
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="event-location">Location (optional)</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Station"
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-description">Description (optional)</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                if (guard.requestClose()) onClose();
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? "Saving…" : event ? "Save changes" : "Add event"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <DeleteConfirmDialog
        open={guard.promptOpen}
        onOpenChange={guard.setPromptOpen}
        title="Discard unsaved changes?"
        description="This event has unsaved changes. Leaving now will lose them."
        confirmLabel="Discard"
        onConfirm={guard.confirmDiscard}
      />
    </>
  );
}
