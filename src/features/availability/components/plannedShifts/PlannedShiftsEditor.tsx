import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { addDays, format, isSameDay, parseISO, startOfDay, startOfMonth } from "date-fns";
import type { DayButtonProps, Modifiers } from "@daypicker/react";
import { Plus, X } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { SHIFT_TYPE_FORM_ID, ShiftTypeForm } from "./ShiftTypeForm";
import { WeekView } from "./WeekView";
import {
  HORIZON_DAYS,
  SHIFT_COLOURS,
  afterStatusLabel,
  errorText,
  shiftColour,
  toDateKey,
} from "./shiftOptions";

const MAX_SHIFT_TYPES = 6;
const UPCOMING_PREVIEW = 5;

type View =
  | { kind: "main" }
  | { kind: "new" }
  | { kind: "edit"; typeId: Id<"shiftTypes"> };

// Week suits shifts whose times vary; Calendar suits fixed shift types. Both
// edit the same shifts. The choice is a per-device convenience, so it lives in
// localStorage and falls back to Week.
type Tab = "week" | "calendar";
const TAB_STORAGE_KEY = "bravo.plannedShifts.tab";

function readStoredTab(): Tab {
  try {
    return localStorage.getItem(TAB_STORAGE_KEY) === "calendar" ? "calendar" : "week";
  } catch {
    return "week";
  }
}

function storeTab(tab: Tab) {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
}

// A day cell with a coloured bar under the number for the shift on that date.
// The bar's colour comes from the `shift0`..`shift5` modifiers, or
// `shiftOneOff` for a shift entered by its times in the week view.
function ShiftDayButton({ day: _day, modifiers, className, children, ...props }: DayButtonProps) {
  const colour = modifiers.shiftOneOff ? -1 : SHIFT_COLOURS.findIndex((_, i) => modifiers[`shift${i}`]);
  return (
    <button
      {...props}
      className={cn(
        className,
        "flex flex-col items-center justify-center gap-1",
        modifiers.busy && "animate-pulse",
      )}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          "h-1 w-5 rounded-full",
          modifiers.shiftOneOff || colour >= 0 ? shiftColour(colour).dot : "bg-transparent",
        )}
      />
    </button>
  );
}

function timeRange(startAt: number, endAt: number) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const endLabel = format(end, "HH:mm") + (isSameDay(start, end) ? "" : ` ${format(end, "EEE")}`);
  return `${format(start, "HH:mm")} → ${endLabel}`;
}

interface PlannedShiftsEditorProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Planned shifts, two ways in to the same shifts: a Week view of start and
 * finish times for rosters that vary, and a Calendar where a shift type is
 * picked and then stamped on dates. Shift types are created and edited in a
 * second view inside the same modal.
 */
export function PlannedShiftsEditor({ open, onClose }: PlannedShiftsEditorProps) {
  const posthog = usePostHog();
  const today = startOfDay(new Date());
  const lastDay = addDays(today, HORIZON_DAYS);

  const types = useQuery(api.plannedShifts.getMyShiftTypes, open ? {} : "skip");
  const shifts = useQuery(
    api.plannedShifts.getMyPlannedShifts,
    open ? { from: toDateKey(startOfMonth(today)), to: toDateKey(lastDay) } : "skip",
  );
  const toggleShift = useMutation(api.plannedShifts.toggleShiftOnDate);
  const removeShift = useMutation(api.plannedShifts.removePlannedShift);

  const [view, setView] = useState<View>({ kind: "main" });
  const [tab, setTab] = useState<Tab>(readStoredTab);
  const [selectedId, setSelectedId] = useState<Id<"shiftTypes"> | undefined>();
  const [month, setMonth] = useState(today);
  const [busyDates, setBusyDates] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = types?.find((t) => t._id === selectedId) ?? types?.[0];
  const editing = view.kind === "edit" ? types?.find((t) => t._id === view.typeId) : undefined;
  const noTypesYet = types !== undefined && types.length === 0;
  const showForm = view.kind === "new" || !!editing;

  const modifiers = useMemo(() => {
    const result: Record<string, Date[]> = { busy: [...busyDates].map((d) => parseISO(d)) };
    result.shiftOneOff = [];
    SHIFT_COLOURS.forEach((_, i) => (result[`shift${i}`] = []));
    for (const shift of shifts ?? []) {
      const key = shift.colour < 0 ? "shiftOneOff" : `shift${shift.colour % SHIFT_COLOURS.length}`;
      result[key].push(parseISO(shift.date));
    }
    return result;
  }, [shifts, busyDates]);

  const now = Date.now();
  const upcoming = (shifts ?? []).filter((s) => s.endAt > now);
  const visibleUpcoming = showAll ? upcoming : upcoming.slice(0, UPCOMING_PREVIEW);

  const close = () => {
    setView({ kind: "main" });
    setShowAll(false);
    onClose();
  };

  const setBusy = (date: string, busy: boolean) =>
    setBusyDates((prev) => {
      const next = new Set(prev);
      if (busy) next.add(date);
      else next.delete(date);
      return next;
    });

  const handleDayClick = async (date: Date, dayModifiers: Modifiers) => {
    if (dayModifiers.disabled || !selected) return;
    const key = toDateKey(date);
    if (busyDates.has(key)) return;
    setBusy(key, true);
    try {
      const result = await toggleShift({ date: key, shiftTypeId: selected._id });
      posthog?.capture("planned_shift_toggled", { result });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(key, false);
    }
  };

  const handleRemove = async (id: Id<"plannedShifts">) => {
    try {
      await removeShift({ id });
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const title = editing ? `Edit ${editing.name}` : view.kind === "new" ? "New shift type" : "Planned shifts";

  const footer = showForm ? (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setView({ kind: "main" })}
      >
        Cancel
      </Button>
      <Button type="submit" form={SHIFT_TYPE_FORM_ID} disabled={saving}>
        {editing && editing.pendingCount > 0
          ? `Save · updates ${editing.pendingCount} upcoming shift${editing.pendingCount === 1 ? "" : "s"}`
          : "Save"}
      </Button>
    </>
  ) : (
    <Button type="button" onClick={close}>
      Done
    </Button>
  );

  const upcomingList = upcoming.length > 0 && (
    <section className="mt-6 pb-4">
      <h3 className="mb-2 text-sm font-medium">Upcoming</h3>
      <ul className="divide-y divide-border rounded-md border border-border">
        {visibleUpcoming.map((shift) => (
          <li key={shift._id} className="flex items-center gap-3 py-2 pl-3 pr-1 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="w-[4.75rem] shrink-0 font-medium">{format(parseISO(shift.date), "EEE d MMM")}</span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", shiftColour(shift.colour).dot)} />
                  {shift.name}
                </span>
                <span className="text-muted-foreground">{timeRange(shift.startAt, shift.endAt)}</span>
              </div>
              {(shift.afterStatus !== "reset" || shift.state === "skipped") && (
                <div className="text-xs text-muted-foreground">
                  {shift.state === "skipped"
                    ? "Not applied: your own status ran past it"
                    : `then ${afterStatusLabel(shift.afterStatus)}`}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 touch-manipulation"
              aria-label={`Remove ${shift.name} on ${format(parseISO(shift.date), "EEE d MMM")}`}
              onClick={() => handleRemove(shift._id)}
            >
              <X aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      {upcoming.length > UPCOMING_PREVIEW && (
        <div className="mt-1 text-right">
          <Button type="button" variant="link" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${upcoming.length}`}
          </Button>
        </div>
      )}
    </section>
  );

  const calendar = (
    <Calendar
      month={month}
      onMonthChange={setMonth}
      startMonth={today}
      endMonth={lastDay}
      weekStartsOn={1}
      showOutsideDays={false}
      disabled={[{ before: today }, { after: lastDay }]}
      modifiers={modifiers}
      onDayClick={handleDayClick}
      components={{ DayButton: ShiftDayButton }}
      className="px-0"
    />
  );

  const calendarTab = noTypesYet ? (
    <>
      <p className="text-sm text-muted-foreground">
        For shifts with the same times each time, like Night 21:00 to 07:30. Add it once, then tap
        the dates you work it.
      </p>
      <Button type="button" variant="outline" className="mt-3 h-10" onClick={() => setView({ kind: "new" })}>
        <Plus aria-hidden="true" />
        New shift type
      </Button>
      {calendar}
      {upcomingList}
    </>
  ) : (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        <ToggleGroup
          type="single"
          variant="outline"
          value={selected?._id ?? ""}
          onValueChange={(value) => {
            // Tapping the chip that's already selected opens it for editing.
            if (!value) {
              if (selected) setView({ kind: "edit", typeId: selected._id });
              return;
            }
            setSelectedId(value as Id<"shiftTypes">);
          }}
          className="w-max flex-nowrap justify-start"
          aria-label="Shift type"
        >
          {(types ?? []).map((type) => (
            <ToggleGroupItem
              key={type._id}
              value={type._id}
              className={cn("h-10 shrink-0 px-3 data-[state=on]:ring-2", shiftColour(type.colour).ring)}
            >
              <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", shiftColour(type.colour).dot)} />
              {type.name}
            </ToggleGroupItem>
          ))}
          {(types ?? []).length < MAX_SHIFT_TYPES && (
            <Button
              type="button"
              variant="ghost"
              className="h-10 shrink-0 px-3"
              onClick={() => setView({ kind: "new" })}
            >
              <Plus aria-hidden="true" />
              New
            </Button>
          )}
        </ToggleGroup>
      </div>

      {calendar}

      {selected && (
        <p className="text-center text-sm text-muted-foreground">
          Tap a date to add or remove a {selected.name} shift. Tap {selected.name} again to edit it.
        </p>
      )}

      {upcomingList}
    </>
  );

  return (
    <ResponsiveModal open={open} onClose={close} title={title} footer={footer}>
      {types === undefined || shifts === undefined ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : showForm ? (
        <ShiftTypeForm
          key={editing?._id ?? "new"}
          initial={editing}
          onSavingChange={setSaving}
          onDone={(createdId) => {
            if (createdId) setSelectedId(createdId);
            setView({ kind: "main" });
          }}
        />
      ) : (
        <>
          <ToggleGroup
            type="single"
            variant="outline"
            value={tab}
            onValueChange={(value) => {
              if (!value) return;
              setTab(value as Tab);
              storeTab(value as Tab);
            }}
            className="mb-3 grid grid-cols-2"
            aria-label="How to enter shifts"
          >
            <ToggleGroupItem value="week" className="h-10">
              Week
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" className="h-10">
              Calendar
            </ToggleGroupItem>
          </ToggleGroup>

          {tab === "week" ? <WeekView shifts={shifts} today={today} lastDay={lastDay} /> : calendarTab}
        </>
      )}
    </ResponsiveModal>
  );
}
