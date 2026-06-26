import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface CompleteTaskDialogProps {
  taskId: Id<"actionTasks">;
  taskTitle: string;
  open: boolean;
  onClose: () => void;
}

export function CompleteTaskDialog({ taskId, taskTitle, open, onClose }: CompleteTaskDialogProps) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const completeTask = useMutation(api.actionCenter.completeTask);
  const reopenTask = useMutation(api.actionCenter.reopenTask);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await completeTask({ taskId, notes: notes.trim() || undefined });
      onClose();
      toast.success("Task completed", {
        action: {
          label: "Undo",
          onClick: () => reopenTask({ taskId }).catch(() => toast.error("Failed to reopen task")),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to complete task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">{taskTitle}</p>
          <div className="space-y-1.5">
            <Label htmlFor="completion-notes">Notes (optional)</Label>
            <Textarea
              id="completion-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any completion notes..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={loading}>
            {loading ? "Completing..." : "Mark Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
