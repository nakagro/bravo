import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Clock, User, History } from "lucide-react";

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

export function InventoryRecentChecks() {
  const summaries = useQuery(api.inventoryCheckRuns.listRunSummaries, { limit: 50 }) as RunSummary[] | undefined;
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("all");

  // Get unique template names for filtering
  const templateNames = useMemo(() => {
    if (!summaries) return [];
    const names = new Set(summaries.map(s => s.run.templateName));
    return Array.from(names).sort();
  }, [summaries]);

  // Filter summaries by selected template
  const filteredSummaries = useMemo(() => {
    if (!summaries) return [];
    if (selectedTemplate === "all") return summaries;
    return summaries.filter(s => s.run.templateName === selectedTemplate);
  }, [summaries, selectedTemplate]);

  return (
    <div className="space-y-4">
      {/* Template Filter */}
      {templateNames.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Template</h3>
          </div>
          <div className="p-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTemplate("all")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedTemplate === "all"
                  ? "bg-red-600 text-white dark:bg-red-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
              >
                All ({summaries?.length || 0})
              </button>
              {templateNames.map((name) => {
                const count = summaries?.filter(s => s.run.templateName === name).length || 0;
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedTemplate(name)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedTemplate === name
                      ? "bg-red-600 text-white dark:bg-red-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                  >
                    {name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      <div className="space-y-3">
        {(!filteredSummaries || filteredSummaries.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
              <History className="h-10 w-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {selectedTemplate === "all" ? "No check history" : `No history for ${selectedTemplate}`}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">
              {selectedTemplate === "all" 
                ? "Completed inventory checks will appear here."
                : "Completed checks for this template will appear here."
              }
            </p>
          </div>
        )}

        {filteredSummaries?.map((s) => {
          const completionRate = s.total > 0 ? Math.round(((s.yes + s.no) / s.total) * 100) : 0;
          const hasIssues = s.no > 0;

          // Get user display name
          const getUserName = (user: RunSummary['completedByUser']) => {
            if (!user) return null;
            return user.name ||
              (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) ||
              user.memberNumber ||
              'Unknown';
          };

          const completedByName = s.run.status === "completed" ? getUserName(s.completedByUser) : null;
          const startedByName = getUserName(s.startedByUser);

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
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      <span>{s.yes}</span>
                    </div>
                    {s.no > 0 && (
                      <div className="flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        <span>{s.no}</span>
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
      </div>
    </div>
  );
}

export default InventoryRecentChecks;
