import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  AFTER_STATUS_OPTIONS,
  PLANNED_STATUS_OPTIONS,
  afterStatusLabel,
  digitsToTime,
  errorText,
  timeToDigits,
  type AfterStatus,
  type PlannedStatus,
} from "./shiftOptions";

export const SHIFT_TYPE_FORM_ID = "shift-type-form";

export interface ShiftTypeValues {
  _id: Id<"shiftTypes">;
  name: string;
  startTime: string;
  endTime: string;
  status: PlannedStatus;
  afterStatus: AfterStatus;
  pendingCount: number;
}

interface ShiftTypeFormProps {
  /** The type being edited, or undefined for a new one. */
  initial?: ShiftTypeValues;
  /** Called after a save or delete, with the new type's id when one was created. */
  onDone: (createdId?: Id<"shiftTypes">) => void;
  onSavingChange: (saving: boolean) => void;
}

/**
 * New or edit shift type. Rendered as a view inside the planned shifts modal,
 * not a nested drawer: stacked vaul drawers fight the iOS keyboard. The modal
 * footer's Save button submits this form via SHIFT_TYPE_FORM_ID.
 */
export function ShiftTypeForm({ initial, onDone, onSavingChange }: ShiftTypeFormProps) {
  const posthog = usePostHog();
  const createShiftType = useMutation(api.plannedShifts.createShiftType);
  const updateShiftType = useMutation(api.plannedShifts.updateShiftType);
  const deleteShiftType = useMutation(api.plannedShifts.deleteShiftType);

  const [name, setName] = useState(initial?.name ?? "");
  const [start, setStart] = useState(initial ? timeToDigits(initial.startTime) : "");
  const [end, setEnd] = useState(initial ? timeToDigits(initial.endTime) : "");
  const [status, setStatus] = useState<PlannedStatus>(initial?.status ?? "not available");
  const [afterStatus, setAfterStatus] = useState<AfterStatus>(initial?.afterStatus ?? "reset");
  const [showAfterOptions, setShowAfterOptions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startTime = digitsToTime(start);
  const endTime = digitsToTime(end);
  const overnight = !!startTime && !!endTime && endTime < startTime;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the shift a name, e.g. Night.");
      return;
    }
    if (!startTime || !endTime) {
      toast.error("Enter start and end as 4 digits, e.g. 2100.");
      return;
    }
    const fields = { name: name.trim(), startTime, endTime, status, afterStatus };
    onSavingChange(true);
    try {
      if (initial) {
        await updateShiftType({ id: initial._id, ...fields });
        onDone();
      } else {
        const id = await createShiftType(fields);
        posthog?.capture("planned_shift_type_created", {
          status,
          after_status: afterStatus,
          overnight,
        });
        toast.success(`${fields.name} added. Tap dates to plan your shifts.`);
        onDone(id);
      }
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      onSavingChange(false);
    }
  };

  const handleDelete = async () => {
    if (!initial) return;
    try {
      await deleteShiftType({ id: initial._id });
      toast.success(`${initial.name} deleted`);
      onDone();
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const timeInput = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
  ) => (
    <div className="flex-1 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className="text-base md:text-sm"
      />
    </div>
  );

  return (
    <form id={SHIFT_TYPE_FORM_ID} onSubmit={handleSubmit} className="space-y-5 pb-4">
      <div className="space-y-1.5">
        <Label htmlFor="shift-type-name">Name</Label>
        <Input
          id="shift-type-name"
          placeholder="e.g. Night"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          className="text-base md:text-sm"
        />
      </div>

      <div>
        <div className="flex gap-3">
          {timeInput("shift-type-start", "Start", start, setStart, "2100")}
          {timeInput("shift-type-end", "End", end, setEnd, "0730")}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {overnight ? "Ends next day." : "24-hour time, 4 digits."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Mark me as</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={status}
          onValueChange={(v) => v && setStatus(v as PlannedStatus)}
          className="justify-start flex-wrap"
        >
          {PLANNED_STATUS_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className="h-10 px-3">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="rounded-md border border-border">
        <button
          type="button"
          onClick={() => setShowAfterOptions((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-3 text-left text-sm"
          aria-expanded={showAfterOptions}
        >
          <span>
            When it ends: <span className="font-medium">{afterStatusLabel(afterStatus)}</span>
          </span>
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", showAfterOptions && "rotate-90")}
            aria-hidden="true"
          />
        </button>
        {showAfterOptions && (
          <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
            {AFTER_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setAfterStatus(option.value);
                  setShowAfterOptions(false);
                }}
                className={cn(
                  "rounded px-3 py-2 text-sm transition-colors",
                  option.color,
                  afterStatus === option.value && "ring-2 ring-blue-500",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {initial && (
        <>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm font-medium text-red-600 dark:text-red-400"
          >
            Delete shift type
          </button>
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {initial.name}?</AlertDialogTitle>
                <AlertDialogDescription>Shifts already on the calendar stay.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </form>
  );
}
