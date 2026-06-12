import { useState } from "react";
import { format } from "date-fns";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  LoaderCircle,
  Trash2,
  Clock,
  UserCheck,
  Flame,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { USAGE_TYPE_LABEL } from "../lib/currency";

const NOTES_CLAMP_THRESHOLD = 140;

interface BARecord {
  _id: Id<"baRecords">;
  memberId: Id<"users">;
  memberName: string;
  dateUsed: string;
  durationMinutes: number;
  usageType: "firecall" | "drill";
  notes: string;
  verifierName: string;
  submitterName: string;
  submittedBy: Id<"users">;
  submittedOnBehalf: boolean;
  createdAt: number;
}

interface BARecordCardProps {
  record: BARecord;
  canDelete: boolean;
}

const USAGE_ICON = {
  firecall: Flame,
  drill: GraduationCap,
} as const;

const USAGE_BADGE_VARIANT: Record<BARecord["usageType"], "destructive" | "secondary"> = {
  firecall: "destructive",
  drill: "secondary",
};

export function BARecordCard({ record, canDelete }: BARecordCardProps) {
  const deleteRecord = useMutation(api.baRecords.deleteRecord);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const Icon = USAGE_ICON[record.usageType];
  const date = new Date(record.dateUsed);
  const notesAreLong = record.notes.length > NOTES_CLAMP_THRESHOLD;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRecord({ recordId: record._id });
      toast.success("Record deleted");
    } catch (err) {
      console.error("Failed to delete record:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete record");
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="flex items-start gap-3">
          {/* Date tile */}
          <div
            className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-muted"
            aria-hidden="true"
          >
            <span className="text-base font-bold leading-tight text-foreground tabular-nums">
              {format(date, "d")}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {format(date, "MMM")}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-foreground">{record.memberName}</span>
              <Badge
                variant={USAGE_BADGE_VARIANT[record.usageType]}
                className="flex items-center gap-1"
              >
                <Icon className="h-3 w-3" />
                {USAGE_TYPE_LABEL[record.usageType]}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="sr-only">{format(date, "EEEE, d MMMM yyyy")}</span>
              <span aria-hidden="true">{format(date, "EEEE")}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {record.durationMinutes} min
              </span>
              <span className="flex items-center gap-1">
                <UserCheck className="h-3 w-3" />
                {record.verifierName}
              </span>
              {record.submittedOnBehalf && <span>Logged by {record.submitterName}</span>}
            </div>

            {record.notes && (
              <div>
                <p
                  className={`whitespace-pre-wrap text-sm text-foreground/80 ${
                    notesAreLong && !notesExpanded ? "line-clamp-2" : ""
                  }`}
                >
                  {record.notes}
                </p>
                {notesAreLong && (
                  <button
                    type="button"
                    onClick={() => setNotesExpanded((prev) => !prev)}
                    className="mt-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {notesExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}
          </div>

          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
              aria-label="Delete record"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete BA record?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
