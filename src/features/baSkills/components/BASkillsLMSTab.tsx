import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, ChevronDown, Clock, LoaderCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { USAGE_TYPE_LABEL } from "../lib/currency";

const ENTERED_PREVIEW_COUNT = 10;

type BARecord = {
  _id: Id<"baRecords">;
  memberName: string;
  dateUsed: string;
  durationMinutes: number;
  usageType: "firecall" | "drill";
  verifierName: string;
  submitterName: string;
  submittedOnBehalf: boolean;
  lmsEnteredAt?: number;
  lmsEnteredByName?: string;
};

interface LMSRecordRowProps {
  record: BARecord;
  isUpdating: boolean;
  onSetEntered: (recordId: Id<"baRecords">, entered: boolean) => void;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}

function LMSRecordRow({
  record,
  isUpdating,
  onSetEntered,
  selected,
  onSelectedChange,
}: LMSRecordRowProps) {
  const isEntered = record.lmsEnteredAt !== undefined;
  const selectable = onSelectedChange !== undefined;

  return (
    <div
      className={`rounded-lg border bg-card p-4 shadow-sm transition-colors ${
        selected ? "border-primary/50 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex gap-3">
        {selectable && (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(checked === true)}
            disabled={isUpdating}
            aria-label={`Select record for ${record.memberName}`}
            className="mt-1"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{record.memberName}</span>
              <Badge variant={record.usageType === "firecall" ? "destructive" : "secondary"}>
                {USAGE_TYPE_LABEL[record.usageType]}
              </Badge>
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

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>{format(new Date(record.dateUsed), "EEE, d MMM yyyy")}</span>
              <span>{record.durationMinutes} min on air</span>
              <span>Verified by {record.verifierName}</span>
              {record.submittedOnBehalf && <span>Logged by {record.submitterName}</span>}
            </div>

            {isEntered && record.lmsEnteredAt && (
              <div className="mt-1 text-xs text-muted-foreground">
                Marked by {record.lmsEnteredByName ?? "Unknown"} ·{" "}
                {format(new Date(record.lmsEnteredAt), "d MMM yyyy, h:mm a")}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant={isEntered ? "outline" : "default"}
            size="sm"
            disabled={isUpdating}
            onClick={() => onSetEntered(record._id, !isEntered)}
            className="w-full sm:w-auto"
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
        </div>
      </div>
    </div>
  );
}

export function BASkillsLMSTab() {
  const records = useQuery(api.baRecords.listRecords, {});
  const setLmsEntered = useMutation(api.baRecords.setLmsEntered);
  const [updatingRecordId, setUpdatingRecordId] = useState<Id<"baRecords"> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"baRecords">>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [showAllEntered, setShowAllEntered] = useState(false);

  const { pendingRecords, enteredRecords } = useMemo(() => {
    const list = records ?? [];
    return {
      pendingRecords: list.filter((record) => record.lmsEnteredAt === undefined),
      enteredRecords: list
        .filter((record) => record.lmsEnteredAt !== undefined)
        .sort((a, b) => (b.lmsEnteredAt ?? 0) - (a.lmsEnteredAt ?? 0)),
    };
  }, [records]);

  // Selection can go stale when records change underneath it (realtime updates)
  const selectedPending = pendingRecords.filter((r) => selectedIds.has(r._id));
  const allPendingSelected =
    pendingRecords.length > 0 && selectedPending.length === pendingRecords.length;

  const visibleEntered = showAllEntered
    ? enteredRecords
    : enteredRecords.slice(0, ENTERED_PREVIEW_COUNT);

  const toggleSelected = (recordId: Id<"baRecords">, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(recordId);
      else next.delete(recordId);
      return next;
    });
  };

  const toggleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? new Set(pendingRecords.map((r) => r._id)) : new Set());
  };

  const handleSetEntered = async (recordId: Id<"baRecords">, entered: boolean) => {
    setUpdatingRecordId(recordId);
    try {
      await setLmsEntered({ recordId, entered });
      toast.success(entered ? "Record marked as entered into LMS" : "Record moved back to pending");
      setSelectedIds((prev) => {
        if (!prev.has(recordId)) return prev;
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    } catch (err) {
      console.error("Failed to update LMS status:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update LMS status");
    } finally {
      setUpdatingRecordId(null);
    }
  };

  const handleBulkMarkEntered = async () => {
    if (selectedPending.length === 0) return;
    setIsBulkUpdating(true);
    const results = await Promise.allSettled(
      selectedPending.map((record) => setLmsEntered({ recordId: record._id, entered: true })),
    );
    setIsBulkUpdating(false);
    setSelectedIds(new Set());

    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.length - failed;
    if (failed === 0) {
      toast.success(
        succeeded === 1
          ? "1 record marked as entered into LMS"
          : `${succeeded} records marked as entered into LMS`,
      );
    } else {
      toast.error(`${failed} of ${results.length} records failed to update`);
    }
  };

  if (records === undefined) {
    return (
      <div data-component="BASkillsLMSTab">
        <div className="flex items-center justify-center p-8">
          <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-component="BASkillsLMSTab">
      <div>
        <h2 className="text-lg font-semibold text-foreground">LMS entry queue</h2>
        <p className="text-sm text-muted-foreground">
          Records waiting to be keyed into the CFA LMS. {pendingRecords.length} pending ·{" "}
          {enteredRecords.length} entered.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="ba-lms-pending-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h3 id="ba-lms-pending-heading" className="text-sm font-semibold text-foreground">
            Pending LMS entry
          </h3>
          {pendingRecords.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={allPendingSelected}
                  onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                  disabled={isBulkUpdating}
                  aria-label="Select all pending records"
                />
                Select all
              </label>
              {selectedPending.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  className="ml-auto"
                  disabled={isBulkUpdating}
                  onClick={handleBulkMarkEntered}
                >
                  {isBulkUpdating ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Mark {selectedPending.length} entered
                </Button>
              )}
            </>
          )}
        </div>

        {pendingRecords.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded border border-dashed border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-6 text-center">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-sm text-green-700 dark:text-green-300">
              All caught up — no BA records are waiting for LMS entry.
            </p>
          </div>
        ) : (
          pendingRecords.map((record) => (
            <LMSRecordRow
              key={record._id}
              record={record}
              isUpdating={updatingRecordId === record._id || isBulkUpdating}
              onSetEntered={handleSetEntered}
              selected={selectedIds.has(record._id)}
              onSelectedChange={(selected) => toggleSelected(record._id, selected)}
            />
          ))
        )}
      </section>

      {enteredRecords.length > 0 && (
        <section className="space-y-3" aria-labelledby="ba-lms-entered-heading">
          <h3 id="ba-lms-entered-heading" className="text-sm font-semibold text-foreground">
            Recently entered
          </h3>
          {visibleEntered.map((record) => (
            <LMSRecordRow
              key={record._id}
              record={record}
              isUpdating={updatingRecordId === record._id}
              onSetEntered={handleSetEntered}
            />
          ))}
          {enteredRecords.length > ENTERED_PREVIEW_COUNT && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowAllEntered((prev) => !prev)}
            >
              <ChevronDown
                className={`mr-2 h-4 w-4 transition-transform ${showAllEntered ? "rotate-180" : ""}`}
              />
              {showAllEntered
                ? "Show recent only"
                : `Show all ${enteredRecords.length} entered records`}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
