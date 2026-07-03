import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { RotateCcw, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "../types";

export interface OverrideAssignment {
  date: number;
  dutyCrewId: Id<"dutyCrew">;
  isSpecial: boolean;
  notes?: string;
  scheduleId?: Id<"dutyCrewSchedule">;
}

interface ScheduleOverridePanelProps {
  assignment: OverrideAssignment | null;
  onClose: () => void;
}

export function ScheduleOverridePanel({
  assignment,
  onClose,
}: ScheduleOverridePanelProps) {
  const dutyCrews = useQuery(api.dutyCrew.getAllDutyCrews, {});
  const assignDutyCrew = useMutation(api.dutyCrew.assignDutyCrew);
  const deleteAssignment = useMutation(api.dutyCrew.deleteAssignment);

  const [selectedCrewId, setSelectedCrewId] = useState<string>("");
  const [isSpecial, setIsSpecial] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Re-seed form state whenever a different Sunday is opened
  useEffect(() => {
    if (assignment) {
      setSelectedCrewId(assignment.dutyCrewId);
      setIsSpecial(assignment.isSpecial);
      setNotes(assignment.notes ?? "");
    }
  }, [assignment]);

  if (!assignment) return null;

  const handleSave = async () => {
    if (!selectedCrewId) return;
    try {
      setIsSaving(true);
      await assignDutyCrew({
        date: assignment.date,
        dutyCrewId: selectedCrewId as Id<"dutyCrew">,
        isSpecial,
        notes: notes.trim() || undefined,
      });
      toast.success("Schedule updated");
      onClose();
    } catch (error) {
      console.error("Error saving schedule override:", error);
      toast.error("Failed to update schedule");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!assignment.scheduleId) return;
    try {
      await deleteAssignment({ id: assignment.scheduleId });
      toast.success("Reset to default rotation");
      onClose();
    } catch (error) {
      console.error("Error resetting schedule override:", error);
      toast.error("Failed to reset schedule");
    }
  };

  return (
    <ResponsiveModal
      open={!!assignment}
      onClose={onClose}
      title="Edit Schedule"
      drawerHeight="h-auto max-h-[90vh]"
      footer={
        <div className="flex flex-col gap-2 p-4 pt-2">
          <Button
            onClick={handleSave}
            disabled={!selectedCrewId || isSaving}
            className="w-full"
            size="lg"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </Button>
          {assignment.scheduleId && (
            <DeleteConfirmDialog
              title="Reset to default rotation?"
              description="This removes the manual override for this Sunday. The crew will revert to the normal rotation (1st Sunday = Crew 1, and so on)."
              confirmLabel="Reset"
              trigger={
                <Button variant="outline" className="w-full" size="lg">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to default rotation
                </Button>
              }
              onConfirm={handleReset}
            />
          )}
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {formatDate(assignment.date)}
        </p>

        <div>
          <Label>Duty Crew</Label>
          <Select value={selectedCrewId} onValueChange={setSelectedCrewId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select a crew" />
            </SelectTrigger>
            <SelectContent>
              {(dutyCrews ?? []).map((crew) => (
                <SelectItem key={crew._id} value={crew._id}>
                  {crew.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 py-1">
          <div>
            <Label htmlFor="special-switch">Special (working bee)</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              All duty crew members attend
            </p>
          </div>
          <Switch
            id="special-switch"
            checked={isSpecial}
            onCheckedChange={setIsSpecial}
          />
        </div>

        <div>
          <Label>Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Swapped with Crew 2 this week"
            className="mt-1 resize-none min-h-[80px] text-base md:text-sm"
          />
        </div>
      </div>
    </ResponsiveModal>
  );
}
