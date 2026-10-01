import { useState, type FocusEvent } from "react";
import { useMutation } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { addDays, format, isAfter } from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { digitsToTime, errorText, shiftColour, toDateKey } from "./shiftOptions";

const DAYS_PER_PAGE = 7;

type PlannedShift = Pick<
  Doc<"plannedShifts">,
  "_id" | "name" | "colour" | "date" | "startAt" | "endAt"
>;

interface WeekViewProps {
  shifts: PlannedShift[];
  today: Date;
  lastDay: Date;
}

/**
 * The next 7 days as rows of start and finish times, for members whose shifts
 * don't follow fixed patterns. Edits the same shifts the calendar stamps.
 */
export function WeekView({ shifts, today, lastDay }: WeekViewProps) {
  const [page, setPage] = useState(0);
  const byDate = new Map(shifts.map((s) => [s.date, s]));

  const first = addDays(today, page * DAYS_PER_PAGE);
  const days = Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(first, i)).filter(
    (d) => !isAfter(d, lastDay),
  );
  const hasNext = !isAfter(addDays(first, DAYS_PER_PAGE), lastDay);

  return (
    <div className="pb-4">
      <div className="mb-1 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-10", page === 0 && "invisible")}
          onClick={() => setPage((p) => p - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          Back
        </Button>
        <span className="text-sm font-medium">
          {format(days[0], "d MMM")} – {format(days[days.length - 1], "d MMM")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-10", !hasNext && "invisible")}
          onClick={() => setPage((p) => p + 1)}
        >
          Next 7 days
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <div className="divide-y divide-border">
        {days.map((day) => {
          const key = toDateKey(day);
          return <WeekRow key={key} date={day} dateKey={key} shift={byDate.get(key)} />;
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Type 24-hour times as 4 digits, e.g. 0700. A finish earlier than the start runs to the
        next day. You'll be marked not available for the shift, and your status clears when it
        ends.
      </p>
    </div>
  );
}

function WeekRow({
  date,
  dateKey,
  shift,
}: {
  date: Date;
  dateKey: string;
  shift: PlannedShift | undefined;
}) {
  const posthog = usePostHog();
  const setShiftTimes = useMutation(api.plannedShifts.setShiftTimes);
  const removeShift = useMutation(api.plannedShifts.removePlannedShift);

  const serverStart = shift ? format(new Date(shift.startAt), "HHmm") : "";
  const serverEnd = shift ? format(new Date(shift.endAt), "HHmm") : "";
  const serverKey = `${serverStart}-${serverEnd}`;

  const [start, setStart] = useState(serverStart);
  const [end, setEnd] = useState(serverEnd);
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  // Follow the server (a calendar stamp, another device) unless she's typing here.
  const [syncedKey, setSyncedKey] = useState(serverKey);
  if (syncedKey !== serverKey && !focused) {
    setSyncedKey(serverKey);
    setStart(serverStart);
    setEnd(serverEnd);
  }

  const startTime = digitsToTime(start);
  const endTime = digitsToTime(end);
  const overnight = !!startTime && !!endTime && endTime < startTime;
  const label = format(date, "EEE d MMM");

  const save = async (nextStart = start, nextEnd = end) => {
    if (saving) return;
    const s = digitsToTime(nextStart);
    const e = digitsToTime(nextEnd);
    try {
      if (!nextStart && !nextEnd) {
        if (!shift) return;
        setSaving(true);
        await removeShift({ id: shift._id });
        return;
      }
      // Half-typed: keep the draft until both times are complete.
      if (!s || !e) return;
      if (nextStart === serverStart && nextEnd === serverEnd) return;
      setSaving(true);
      const result = await setShiftTimes({ date: dateKey, startTime: s, endTime: e });
      posthog?.capture("planned_shift_times_set", { result });
    } catch (error) {
      toast.error(errorText(error));
      setStart(serverStart);
      setEnd(serverEnd);
    } finally {
      setSaving(false);
    }
  };

  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    // Only when focus leaves the row, not when moving from start to finish.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setFocused(false);
    void save();
  };

  const timeField = (
    which: "start" | "finish",
    value: string,
    onChange: (digits: string) => void,
  ) => (
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      enterKeyHint="done"
      maxLength={4}
      placeholder={which === "start" ? "Start" : "Finish"}
      aria-label={`${which === "start" ? "Start" : "Finish"} on ${label}`}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        "h-10 w-[4.25rem] shrink-0 px-2 text-center text-base md:text-sm",
        value.length === 4 && !digitsToTime(value) && "border-red-500",
      )}
    />
  );

  return (
    <div
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      className={cn("flex items-center gap-2 py-2", saving && "opacity-60")}
    >
      <div className="w-[4.5rem] shrink-0">
        <div className="text-sm font-medium">{label}</div>
        {shift && shift.colour >= 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", shiftColour(shift.colour).dot)} />
            <span className="truncate">{shift.name}</span>
          </div>
        )}
      </div>
      {timeField("start", start, setStart)}
      <span aria-hidden="true" className="text-muted-foreground">→</span>
      {timeField("finish", end, (digits) => {
        setEnd(digits);
        // Finishing the finish time is the natural "done" moment.
        if (digits.length === 4 && startTime) void save(start, digits);
      })}
      <span className="min-w-0 flex-1 text-xs text-muted-foreground">{overnight ? "next day" : ""}</span>
      {shift ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 touch-manipulation"
          aria-label={`Remove shift on ${label}`}
          disabled={saving}
          onClick={async () => {
            setStart("");
            setEnd("");
            try {
              await removeShift({ id: shift._id });
            } catch (error) {
              toast.error(errorText(error));
            }
          }}
        >
          <X aria-hidden="true" />
        </Button>
      ) : (
        <span aria-hidden="true" className="size-10 shrink-0" />
      )}
    </div>
  );
}
