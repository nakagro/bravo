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
  StickyNote,
  UserCheck,
  Flame,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { USAGE_TYPE_LABEL } from "../lib/currency";

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

  const Icon = USAGE_ICON[record.usageType];
  const dateFormatted = format(new Date(record.dateUsed), "EEE, d MMM yyyy");

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
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{record.memberName}</span>
              <Badge variant={USAGE_BADGE_VARIANT[record.usageType]} className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {USAGE_TYPE_LABEL[record.usageType]}
              </Badge>
              {record.submittedOnBehalf && (
                <Badge variant="outline" className="text-xs">
                  Submitted by {record.submitterName}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {record.durationMinutes} min
              </span>
              <span>{dateFormatted}</span>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5" />
              <span>Verified by: {record.verifierName}</span>
            </div>

            {record.notes && (
              <div className="flex items-start gap-1.5 text-sm">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-foreground/80 whitespace-pre-wrap">{record.notes}</span>
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
