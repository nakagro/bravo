import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { format } from "date-fns";
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
  Loader2,
  Trash2,
  Clock,
  MapPin,
  User,
  UserCheck,
  Flame,
  GraduationCap,
} from "lucide-react";

export function BASkillsRecordList() {
  const records = useQuery(api.baSkills.getBASkillsRecords);
  const deleteRecord = useMutation(api.baSkills.deleteBASkillsRecord);
  const currentUser = useQuery(api.baSkills.getCurrentUser);

  const [deleteId, setDeleteId] = useState<Id<"baSkillsRecords"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteRecord({ recordId: deleteId });
    } catch (error) {
      console.error("Failed to delete record:", error);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  if (!records || !currentUser) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-8 text-center">
        <p className="text-muted-foreground">No BA usage records yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit your first record using the form above.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {records.map((record) => {
          const canDelete =
            record.submittedBy === currentUser._id;
          const dateFormatted = format(
            new Date(record.dateUsed),
            "EEE, d MMM yyyy"
          );

          return (
            <div
              key={record._id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  {/* Header with member name and badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {record.memberName}
                    </span>
                    <Badge
                      variant={
                        record.usageType === "firecall"
                          ? "destructive"
                          : "secondary"
                      }
                      className="flex items-center gap-1"
                    >
                      {record.usageType === "firecall" ? (
                        <Flame className="h-3 w-3" />
                      ) : (
                        <GraduationCap className="h-3 w-3" />
                      )}
                      {record.usageType === "firecall"
                        ? "Fire Call"
                        : "Training"}
                    </Badge>
                    {record.submittedOnBehalf && (
                      <Badge variant="outline" className="text-xs">
                        Submitted by {record.submitterName}
                      </Badge>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {record.durationMinutes} min
                    </span>
                    <span>{dateFormatted}</span>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-1.5 text-sm">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-foreground/80">{record.location}</span>
                  </div>

                  {/* Verifier */}
                  {record.verifierName && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Verified by: {record.verifierName}</span>
                    </div>
                  )}
                </div>

                {/* Delete button */}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(record._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete BA Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this BA
              usage record.
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
