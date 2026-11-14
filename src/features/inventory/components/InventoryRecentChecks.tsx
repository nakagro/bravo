import { useMemo, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useNavigate } from "react-router-dom";
import { CircleCheckBig, CircleX, Clock, User, History } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Spinner } from "@/components/ui/spinner";

interface RunSummary {
  run: {
    _id: Id<"applianceCheckRuns">;
    templateName: string;
    templateVersion: number;
    status: "in_progress" | "completed" | "cancelled";
    startedAt: number;
    completedAt?: number;
  };
  total: number;
  yes: number;
  no: number;
  unanswered: number;
  /** Missing items plus miscounts - what actually needs a look */
  deviations: number;
  completedByUser?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    memberNumber?: string;
  } | null;
  startedByUser?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    memberNumber?: string;
  } | null;
}

function formatRelativeDate(ts?: number) {
  if (!ts) return "";
  const now = Date.now();
  const diff = now - ts;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const PAGE_SIZE = 15;

export function InventoryRecentChecks() {
  const navigate = useNavigate();
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<Id<"applianceTemplates"> | null>(null);

  // Every appliance that can have history, including ones since taken out of
  // service - their past checks still matter.
  const templates = useQuery(api.inventoryTemplates.listTemplates, {
    statuses: ["active", "inactive", "archived"],
  });
  const templateOptions = useMemo(
    () =>
      (templates ?? [])
        .map((t) => ({ _id: t._id, name: t.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [templates]
  );
  const selectedName = templateOptions.find((t) => t._id === selectedTemplateId)?.name;

  // Paged and filtered on the server, so an appliance that's checked less
  // often still shows its older checks.
  const { results, status, loadMore } = usePaginatedQuery(
    api.inventoryCheckRuns.listRunSummariesPage,
    selectedTemplateId ? { templateId: selectedTemplateId } : {},
    { initialNumItems: PAGE_SIZE }
  );
  const filteredSummaries = results as RunSummary[];

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 min-h-[36px] rounded-md text-sm font-medium transition-colors ${
      active
        ? "bg-red-600 text-white dark:bg-red-600"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
    }`;

  return (
    <div className="space-y-4">
      {/* Template Filter */}
      {templateOptions.length > 1 && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Template</h3>
          </div>
          <div className="p-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTemplateId(null)}
                aria-pressed={selectedTemplateId === null}
                className={chipClass(selectedTemplateId === null)}
              >
                All
              </button>
              {templateOptions.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setSelectedTemplateId(t._id)}
                  aria-pressed={selectedTemplateId === t._id}
                  className={chipClass(selectedTemplateId === t._id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="space-y-3">
        {status === "LoadingFirstPage" && (
          <div className="flex justify-center py-8">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        )}

        {status !== "LoadingFirstPage" && filteredSummaries.length === 0 && (
          <EmptyState
            icon={<History />}
            title={selectedName ? `No history for ${selectedName}` : "No check history"}
            description={
              !selectedName
                ? "Completed inventory checks will appear here."
                : "Completed checks for this template will appear here."
            }
          />
        )}

        {filteredSummaries.map((s) => {
          const completionRate =
            s.total > 0 ? Math.round(((s.total - s.unanswered) / s.total) * 100) : 0;
          // A miscount is as much an issue as a missing item
          const hasIssues = s.deviations > 0;

          // Get user display name
          const getUserName = (user: RunSummary['completedByUser']) => {
            if (!user) return null;
            return user.name ||
              (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) ||
              user.memberNumber ||
              'Unknown';
          };

          const completedByName = s.run.status === "completed" ? getUserName(s.completedByUser) : null;

          return (
            <div
              key={s.run._id}
              className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                        {s.run.templateName}
                      </h4>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatRelativeDate(s.run.completedAt || s.run.startedAt)}</span>
                      </div>
                      {completedByName && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <User className="w-3.5 h-3.5" />
                          <span>by {completedByName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    {s.run.status === "completed" ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600 dark:bg-green-600">
                        Completed
                      </Badge>
                    ) : s.run.status === "cancelled" ? (
                      <Badge variant="destructive">
                        Cancelled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        In Progress
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer with Stats and Action */}
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  {/* Success Rate */}
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${hasIssues ? 'bg-amber-500' : 'bg-green-500'}`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {completionRate}%
                    </span>
                  </div>

                  {/* Quick Stats */}
                  <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <CircleCheckBig className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      <span>{s.yes}</span>
                    </div>
                    {s.deviations > 0 && (
                      <div className="flex items-center gap-1" title="Missing or miscounted">
                        <CircleX className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        <span>{s.deviations}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/inventory/run/${s.run._id}`)}
                >
                  View Details
                </Button>
              </div>
            </div>
          );
        })}

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
      </div>
    </div>
  );
}

export default InventoryRecentChecks;
