import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { useDirtyDraftGuard } from "@/hooks/useDirtyDraftGuard";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { ordinalSuffix } from "../types";

export interface CrewFormValue {
  id?: Id<"dutyCrew">;
  name: string;
  number: number;
}

interface CrewFormPanelProps {
  /** null = closed; id undefined = create, id set = edit */
  value: CrewFormValue | null;
  onClose: () => void;
}

export function CrewFormPanel({ value, onClose }: CrewFormPanelProps) {
  const createDutyCrew = useMutation(api.dutyCrew.createDutyCrew);
  const updateDutyCrew = useMutation(api.dutyCrew.updateDutyCrew);

  const [name, setName] = useState("");
  const [number, setNumber] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (value) {
      setName(value.name);
      setNumber(value.number);
    }
  }, [value]);

  // No react-hook-form here, so dirtiness is a straight compare against what
  // the panel opened with.
  const isDirty =
    value !== null && (name !== value.name || number !== value.number);
  const guard = useDirtyDraftGuard(isDirty, onClose);

  if (!value) return null;

  const isEditing = value.id !== undefined;

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      setIsSaving(true);
      if (isEditing) {
        await updateDutyCrew({ id: value.id!, name: name.trim() });
        toast.success("Duty crew updated");
      } else {
        await createDutyCrew({ name: name.trim(), number, members: [] });
        toast.success("Duty crew created");
      }
      guard.release();
      onClose();
    } catch (error: any) {
      console.error("Error saving duty crew:", error);
      toast.error(
        error.message ||
          (isEditing ? "Failed to update duty crew" : "Failed to create duty crew")
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ResponsiveModal
        open={!!value}
        onClose={onClose}
        onRequestClose={guard.requestClose}
        title={isEditing ? "Rename Crew" : "New Duty Crew"}
        drawerHeight="h-auto max-h-[90vh]"
        footer={
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : isEditing ? (
              "Save"
            ) : (
              "Create"
            )}
          </Button>
        }
      >
        <div className="space-y-4 pb-4">
          <div>
            <Label>Crew Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Duty Crew 1"
              className="mt-1 text-base md:text-sm"
              autoFocus={!isEditing}
            />
          </div>

          {!isEditing && (
            <div>
              <Label>Sunday Number (1-4)</Label>
              <Select
                value={number.toString()}
                onValueChange={(v) => setNumber(parseInt(v))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {ordinalSuffix(n)} Sunday
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </ResponsiveModal>

      <DeleteConfirmDialog
        open={guard.promptOpen}
        onOpenChange={guard.setPromptOpen}
        title="Discard unsaved changes?"
        description="This crew has unsaved changes. Leaving now will lose them."
        confirmLabel="Discard"
        onConfirm={guard.confirmDiscard}
      />
    </>
  );
}
