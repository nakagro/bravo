import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Inbox, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { cn } from "@/lib/utils";
import { runUserName, type AdminRunSummary } from "./inventoryAdminShared";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/errors";

const PAGE_SIZE = 20;

type StatusFilter = "all" | "completed" | "in_progress" | "cancelled";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "in_progress", label: "Open" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const STATUS_PILL: Record<AdminRunSummary["run"]["status"], { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  },
  in_progress: {
    label: "Open",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  },
};

const EMPTY_COPY: Record<StatusFilter, string> = {
  all: "Checks appear here once someone starts one.",
  completed: "No completed checks yet.",
  in_progress: "Nothing open right now.",
  cancelled: "No cancelled checks.",
};

// Every check ever run, for looking something up or cleaning up the record.
// Filtering and paging happen on the server, so this stays quick however
// long the history gets.
export function InventoryAdminRecords() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<{
    runId: Id<"applianceCheckRuns">;
    label: string;
  } | null>(null);
  const deleteRun = useMutation(api.inventoryCheckRuns.deleteRun);

  const { results, status, loadMore } = usePaginatedQuery(
    api.inventoryCheckRuns.listRunSummariesPage,
    filter === "all" ? {} : { status: filter },
    { initialNumItems: PAGE_SIZE }
  );
  const records = results as AdminRunSummary[];

  const handleDelete = async (runId: Id<"applianceCheckRuns">) => {
    try {
      await deleteRun({ runId });
      toast.success("Inventory check deleted");
    } catch (error) {
      toast.error("Failed to delete inventory check", {
        description: errorMessage(error),
      });
    }
  };

  return (
    <div className="space-y-3">
      <SegmentedTabs
        segments={FILTERS}
        value={filter}
        onChange={setFilter}
        ariaLabel="Filter checks by status"
      />

      {status === "LoadingFirstPage" ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10 text-red-500 dark:text-red-400" />}
          title="No inventory checks"
          description={EMPTY_COPY[filter]}
        />
      ) : (
        <ul className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
          {records.map((s) => {
            const { run } = s;
            const when = new Date(run.completedAt ?? run.startedAt);
            const pill = STATUS_PILL[run.status];
            const who =
              run.status === "completed" ? s.completedByUser : s.startedByUser;
            const answered = s.total - s.unanswered;
            const dateLabel = when.toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <li key={run._id} className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  onClick={() => navigate(`/inventory/run/${run._id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  {/* Date block: the thing people scan by */}
                  <div className="w-11 shrink-0 text-center leading-tight">
                    <div className="text-[10px] font-medium uppercase text-gray-500 dark:text-gray-400">
                      {when.toLocaleDateString("en-AU", { weekday: "short" })}
                    </div>
                    <div className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                      {when.getDate()}
                    </div>
                    <div className="text-[10px] font-medium uppercase text-gray-500 dark:text-gray-400">
                      {when.toLocaleDateString("en-AU", { month: "short" })}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-gray-900 dark:text-white">
                        {run.templateName}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          pill.className
                        )}
                      >
                        {pill.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {who ? `${runUserName(who)} · ` : ""}
                      {answered}/{s.total} checked
                    </p>
                    {s.deviations > 0 && run.status !== "cancelled" && (
                      <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                        {s.deviations} issue{s.deviations === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  aria-label={`Delete ${run.templateName} check from ${dateLabel}`}
                  onClick={() =>
                    setPendingDelete({ runId: run._id, label: `${run.templateName} on ${dateLabel}` })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {status !== "LoadingFirstPage" && status !== "Exhausted" && (
        <Button
          loading={status === "LoadingMore"}
          variant="outline"
          className="w-full min-h-[44px]"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(PAGE_SIZE)}
        >
          Show earlier
        </Button>
      )}

      <ConfirmDialog
        confirmLabel="Delete"
        tone="destructive"
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete inventory check?"
        description={`This permanently deletes the ${pendingDelete?.label ?? ""} check and its answers. It can't be undone.`}
        onConfirm={() => {
          if (!pendingDelete) return;
          const { runId } = pendingDelete;
          setPendingDelete(null);
          void handleDelete(runId);
        }}
      />
    </div>
  );
}
