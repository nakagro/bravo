import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, ChevronDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BARecordCard } from "./BARecordCard";

const ENTERED_PREVIEW_COUNT = 10;

export function BASkillsLMSTab() {
  const records = useQuery(api.baRecords.listRecords, {});
  const setLmsEntered = useMutation(api.baRecords.setLmsEntered);
  const [updatingRecordId, setUpdatingRecordId] = useState<Id<"baRecords"> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"baRecords">>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [showEntered, setShowEntered] = useState(false);
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
      <section className="space-y-3" aria-labelledby="ba-lms-pending-heading">
        <h3 id="ba-lms-pending-heading" className="text-sm font-semibold text-foreground">
          Pending LMS entry
        </h3>

        {pendingRecords.length > 0 && (
          <div className="rounded-md bg-muted/50 p-1">
            <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-2.5 active:bg-muted">
              <Checkbox
                checked={allPendingSelected}
                onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                disabled={isBulkUpdating}
                aria-label="Select all pending records"
                className="h-5 w-5"
              />
              <span className="text-sm font-medium text-muted-foreground">
                Select all &middot; {pendingRecords.length} pending
              </span>
            </label>
            {selectedPending.length > 0 && (
              <div className="px-1 pb-1">
                <Button
                  type="button"
                  className="h-11 w-full"
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
              </div>
            )}
          </div>
        )}

        {pendingRecords.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded border border-dashed border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-6 text-center">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-sm text-green-700 dark:text-green-300">
              All caught up. No BA records are waiting for LMS entry.
            </p>
          </div>
        ) : (
          pendingRecords.map((record) => (
            <BARecordCard
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
          <button
            type="button"
            onClick={() => setShowEntered((prev) => !prev)}
            aria-expanded={showEntered}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="flex items-baseline gap-2">
              <span id="ba-lms-entered-heading" className="text-sm font-semibold text-foreground">
                Recently entered
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {enteredRecords.length === 1 ? "1 record" : `${enteredRecords.length} records`}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                showEntered ? "rotate-180" : ""
              }`}
            />
          </button>

          {showEntered && (
            <>
              {visibleEntered.map((record) => (
                <BARecordCard
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
            </>
          )}
        </section>
      )}
    </div>
  );
}
