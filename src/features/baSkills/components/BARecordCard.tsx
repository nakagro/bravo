import { useState } from "react";
import { format } from "date-fns";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { CheckCircle2, ChevronRight, Clock, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
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
  lmsEnteredAt?: number;
  lmsEnteredByName?: string;
}

interface BARecordCardProps {
  record: BARecord;
  /** History / My Records mode: allow deleting this record from the detail view. */
  canDelete?: boolean;
  /** LMS mode: allow toggling the LMS-entered status from the detail view. */
  onSetEntered?: (recordId: Id<"baRecords">, entered: boolean) => void;
  isUpdating?: boolean;
  /** LMS mode: bulk-select checkbox for the pending queue. */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}

const USAGE_BADGE_VARIANT: Record<BARecord["usageType"], "destructive" | "secondary"> = {
  firecall: "destructive",
  drill: "secondary",
};

export function BARecordCard({
  record,
  canDelete = false,
  onSetEntered,
  isUpdating = false,
  selected,
  onSelectedChange,
}: BARecordCardProps) {
  const deleteRecord = useMutation(api.baRecords.deleteRecord);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const lmsMode = onSetEntered !== undefined;
  const isEntered = record.lmsEnteredAt !== undefined;
  const selectable = onSelectedChange !== undefined;
  const date = new Date(record.dateUsed);

  const wrapperClasses =
    lmsMode && isEntered
      ? "border-border/60 bg-muted/30 p-3 shadow-none"
      : lmsMode && selected
        ? "border-primary/50 bg-primary/5 border-l-4 border-l-primary p-4 shadow-sm"
        : lmsMode
          ? "border-border bg-card border-l-4 border-l-amber-400 dark:border-l-amber-500 p-4 shadow-sm"
          : "border-border bg-card p-3 shadow-sm sm:p-4";

  const tileSizeClasses = lmsMode && isEntered ? "h-10 w-10" : "h-12 w-12";

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRecord({ recordId: record._id });
      toast.success("Record deleted");
      setConfirmOpen(false);
      setDetailOpen(false);
    } catch (err) {
      console.error("Failed to delete record:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete record");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleEntered = () => {
    onSetEntered?.(record._id, !isEntered);
    setDetailOpen(false);
  };

  return (
    <>
      <div className={`flex gap-3 rounded-lg border transition-colors ${wrapperClasses}`}>
        {selectable && (
          <label className="-m-1.5 flex shrink-0 items-start p-1.5">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelectedChange?.(checked === true)}
              disabled={isUpdating}
              aria-label={`Select record for ${record.memberName}`}
              className="mt-0.5 h-5 w-5"
            />
          </label>
        )}

        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex min-w-0 flex-1 gap-3 text-left"
        >
          {/* Date tile + type badge, grouped as one glanceable unit */}
          <div className="flex w-14 shrink-0 flex-col items-center gap-1">
            <div
              className={`flex flex-col items-center justify-center rounded-md bg-muted ${tileSizeClasses}`}
              aria-hidden="true"
            >
              <span className="text-base font-bold leading-tight text-foreground tabular-nums">
                {format(date, "d")}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {format(date, "MMM")}
              </span>
            </div>
            <span className="sr-only">{format(date, "EEEE, d MMMM yyyy")}</span>
            <Badge
              variant={USAGE_BADGE_VARIANT[record.usageType]}
              className="h-5 px-1.5 text-[10px]"
            >
              {USAGE_TYPE_LABEL[record.usageType]}
            </Badge>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-foreground">{record.memberName}</span>
              {lmsMode &&
                (isEntered ? (
                  <Badge variant="outline" className="shrink-0 gap-1 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    LMS entered
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Pending LMS
                  </Badge>
                ))}
            </div>

            <p className="mt-1.5 text-xs text-muted-foreground">
              {record.durationMinutes} min &middot; verified by {record.verifierName}
              {record.submittedOnBehalf && <> &middot; logged by {record.submitterName}</>}
            </p>

            {lmsMode && isEntered && record.lmsEnteredAt && (
              <div className="mt-1 text-xs text-muted-foreground">
                Marked by {record.lmsEnteredByName ?? "Unknown"} ·{" "}
                {format(new Date(record.lmsEnteredAt), "d MMM yyyy, h:mm a")}
              </div>
            )}

            {!lmsMode && record.notes && (
              <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-foreground/80">
                {record.notes}
              </p>
            )}
          </div>

          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 self-center text-muted-foreground/60"
            aria-hidden="true"
          />
        </button>
      </div>

      <ResponsiveModal open={detailOpen} onClose={() => setDetailOpen(false)} title="BA record">
        <div className="space-y-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-foreground">{record.memberName}</p>
              <p className="text-sm text-muted-foreground">
                {format(date, "EEEE, d MMMM yyyy")}
              </p>
            </div>
            <Badge variant={USAGE_BADGE_VARIANT[record.usageType]}>
              {USAGE_TYPE_LABEL[record.usageType]}
            </Badge>
          </div>

          {lmsMode && (
            <div>
              {isEntered ? (
                <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  LMS entered
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Pending LMS
                </Badge>
              )}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 p-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Duration</dt>
              <dd className="font-medium text-foreground">{record.durationMinutes} min</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Verified by</dt>
              <dd className="font-medium text-foreground">{record.verifierName}</dd>
            </div>
            {record.submittedOnBehalf && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Logged by</dt>
                <dd className="font-medium text-foreground">{record.submitterName}</dd>
              </div>
            )}
            {lmsMode && isEntered && record.lmsEnteredAt && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Marked entered</dt>
                <dd className="font-medium text-foreground">
                  {record.lmsEnteredByName ?? "Unknown"} ·{" "}
                  {format(new Date(record.lmsEnteredAt), "d MMM yyyy, h:mm a")}
                </dd>
              </div>
            )}
          </dl>

          {record.notes && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-foreground/80">{record.notes}</p>
            </div>
          )}

          {(canDelete || lmsMode) && (
            <div className="space-y-2 border-t border-border pt-4">
              {lmsMode && (
                <Button
                  type="button"
                  variant={isEntered ? "outline" : "default"}
                  className="w-full"
                  disabled={isUpdating}
                  onClick={handleToggleEntered}
                >
                  {isUpdating ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : isEntered ? (
                    <RotateCcw className="mr-2 h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {isEntered ? "Mark pending" : "Mark entered"}
                </Button>
              )}
              {canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete record
                </Button>
              )}
            </div>
          )}
        </div>
      </ResponsiveModal>

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
