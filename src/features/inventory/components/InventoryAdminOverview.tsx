import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, ClipboardList } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { formatDayTime } from "@/lib/dateFormat";
import { weekBoundaries } from "@/lib/dutyWeek";
import { getRelativeTimeString } from "../../../utils/dateUtils";
import { runUserName, type AdminRunSummary } from "./inventoryAdminShared";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/errors";

interface ApplianceOverview {
  templateId: Id<"applianceTemplates">;
  name: string;
  openRun: AdminRunSummary | null;
  lastCompleted: AdminRunSummary | null;
}

type ApplianceState = "stale" | "due" | "inProgress" | "checked";

// What needs a look sorts to the top: a check left open from an earlier week,
// then appliances nobody has checked, then work under way, then done.
const STATE_ORDER: Record<ApplianceState, number> = {
  stale: 0,
  due: 1,
  inProgress: 2,
  checked: 3,
};

const STATE_BADGE: Record<ApplianceState, { label: string; className: string }> = {
  stale: {
    label: "Left open",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  due: {
    label: "Due",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  inProgress: {
    label: "In progress",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  },
  checked: {
    label: "Checked",
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  },
};

export function InventoryAdminOverview() {
  const navigate = useNavigate();
  const overview = useQuery(api.inventoryCheckRuns.getApplianceOverview) as
    | ApplianceOverview[]
    | undefined;
  const cancelRun = useMutation(api.inventoryCheckRuns.cancelRun);
  const [pendingCancel, setPendingCancel] = useState<{
    runId: Id<"applianceCheckRuns">;
    name: string;
  } | null>(null);

  if (overview === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (overview.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-10 w-10 text-red-500 dark:text-red-400" />}
        title="No appliances yet"
        description="Create and publish a checklist in the Templates tab and it will show up here."
      />
    );
  }

  const week = weekBoundaries(0);
  const inThisWeek = (ts?: number) =>
    ts !== undefined && ts >= week.start.getTime() && ts <= week.end.getTime();

  const stateOf = (a: ApplianceOverview): ApplianceState => {
    if (a.openRun) {
      return a.openRun.run.startedAt < week.start.getTime() ? "stale" : "inProgress";
    }
    return inThisWeek(a.lastCompleted?.run.completedAt) ? "checked" : "due";
  };

  const rows = overview
    .map((a) => ({ ...a, state: stateOf(a) }))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
  const checkedCount = overview.filter((a) =>
    inThisWeek(a.lastCompleted?.run.completedAt)
  ).length;
  const total = overview.length;
  // Named by its Sunday, like everywhere else members see the duty week
  const weekLabel = week.sunday.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const handleCancel = async (runId: Id<"applianceCheckRuns">) => {
    try {
      await cancelRun({ runId });
      toast.success("Inventory check cancelled");
    } catch (error) {
      toast.error("Failed to cancel inventory check", {
        description: errorMessage(error),
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* This week at a glance */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              This duty week
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Week ending {weekLabel}
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
            {checkedCount}
            <span className="text-base font-medium text-gray-400 dark:text-gray-500">
              /{total}
            </span>
          </p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={checkedCount}
          aria-label="Appliances checked this week"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              checkedCount === total ? "bg-green-500" : "bg-amber-500"
            )}
            style={{ width: `${(checkedCount / total) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {checkedCount === total
            ? "Every appliance has been checked this week."
            : `${total - checkedCount} of ${total} appliance${total === 1 ? "" : "s"} still to check this week.`}
        </p>
      </div>

      {/* One row per appliance */}
      <ul className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
        {rows.map((a) => {
          const badge = STATE_BADGE[a.state];
          const target = a.openRun?.run._id ?? a.lastCompleted?.run._id;
          const last = a.lastCompleted;
          const open = a.openRun;

          let detail: React.ReactNode;
          if (open) {
            const answered = open.total - open.unanswered;
            detail = (
              <>
                Started {getRelativeTimeString(open.run.startedAt).toLowerCase()}
                {open.startedByUser ? ` by ${runUserName(open.startedByUser)}` : ""} ·{" "}
                {answered}/{open.total} done
              </>
            );
          } else if (a.state === "checked" && last?.run.completedAt) {
            detail = (
              <>
                {formatDayTime(last.run.completedAt)}
                {last.completedByUser ? ` by ${runUserName(last.completedByUser)}` : ""}
              </>
            );
          } else {
            detail = last?.run.completedAt
              ? `Last checked ${getRelativeTimeString(last.run.completedAt).toLowerCase()}`
              : "Never checked";
          }

          // Issues only for a finished check this week - an open one isn't a
          // verdict yet, and an old one is what the Due badge is about.
          const issues =
            a.state === "checked" && last
              ? [
                  last.deviations > 0
                    ? `${last.deviations} issue${last.deviations === 1 ? "" : "s"}`
                    : null,
                  last.unanswered > 0 ? `${last.unanswered} not checked` : null,
                ].filter(Boolean)
              : [];

          return (
            <li key={a.templateId}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  disabled={!target}
                  onClick={() => target && navigate(`/inventory/run/${target}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-gray-900 dark:text-white">
                        {a.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {detail}
                    </p>
                    {issues.length > 0 && (
                      <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                        {issues.join(" · ")}
                      </p>
                    )}
                    {a.state === "stale" && (
                      <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                        Started before this week - its answers may be out of date.
                      </p>
                    )}
                  </div>
                  {target && !open && (
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  )}
                </button>
                {open && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={() => setPendingCancel({ runId: open.run._id, name: a.name })}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        tone="destructive"
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(null);
        }}
        title="Cancel this inventory check?"
        description={`The open check for "${pendingCancel?.name ?? ""}" will be cancelled and the crew can start a fresh one. It stays in Records as cancelled.`}
        confirmLabel="Cancel check"
        cancelLabel="Keep it open"
        onConfirm={() => {
          if (!pendingCancel) return;
          const { runId } = pendingCancel;
          setPendingCancel(null);
          void handleCancel(runId);
        }}
      />
    </div>
  );
}
