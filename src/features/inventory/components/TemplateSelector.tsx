import React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { PlayIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

interface ApplianceTemplateDoc {
  _id: Id<"applianceTemplates">;
  name: string;
  description?: string;
  version: number;
  hasUnpublishedChanges?: boolean;
  updatedAt: number;
}

interface InProgressRunDoc {
  _id: Id<"applianceCheckRuns">;
  templateId: Id<"applianceTemplates">;
  templateName: string;
  templateVersion: number;
  status: "in_progress" | "completed" | "cancelled";
  startedAt: number;
}

interface LastCompletedRunDoc {
  templateId: string;
  lastCompletedAt?: number;
  lastCompletedRun: {
    _id: Id<"applianceCheckRuns">;
    templateId: Id<"applianceTemplates">;
    completedAt?: number;
  };
}

export function InventoryTemplateSelector() {
  const templates = useQuery(api.inventoryTemplates.getApplianceTemplates) as ApplianceTemplateDoc[] | undefined;
  const startRun = useMutation(api.inventoryCheckRuns.startRun);
  const navigate = useNavigate();
  const inProgressRuns = useQuery(api.inventoryCheckRuns.getInProgressRuns) as InProgressRunDoc[] | undefined;
  const lastCompletedRuns = useQuery(api.inventoryCheckRuns.getLastCompletedRunsByTemplate) as LastCompletedRunDoc[] | undefined;

  const formatDateTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString();
  };

  const formatRelativeTime = (timestamp: number | undefined) => {
    if (!timestamp) return "Never";

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks === 1) return "1 week ago";
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
    if (diffMonths === 1) return "1 month ago";
    if (diffMonths < 12) return `${diffMonths} months ago`;

    const diffYears = Math.floor(diffMonths / 12);
    if (diffYears === 1) return "1 year ago";
    return `${diffYears} years ago`;
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Calculate Monday of current week
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // If Sunday, go back 6 days to Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    // Calculate Sunday of current week (end of week)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday: monday.getTime(), sunday: sunday.getTime() };
  };

  const isCompletedThisWeek = (lastCompletedTimestamp: number | undefined) => {
    if (!lastCompletedTimestamp) return false;

    const { monday, sunday } = getCurrentWeekRange();
    return lastCompletedTimestamp >= monday && lastCompletedTimestamp <= sunday;
  };

  const handleStartCheck = async (tpl: ApplianceTemplateDoc) => {
    if (tpl.hasUnpublishedChanges) {
      alert("This template has unpublished changes. Please publish before starting a check.");
      return;
    }

    // Check if this template was already completed this week
    const lastCompleted = lastCompletedRuns?.find((lc) => lc.templateId === tpl._id);
    const completedThisWeek = isCompletedThisWeek(lastCompleted?.lastCompletedAt);

    if (completedThisWeek) {
      const confirmed = confirm(
        `The ${tpl.name} inventory has already been completed this week. Are you sure you want to start another one?`
      );
      if (!confirmed) {
        return;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    try {
      const runId = await startRun({ templateId: tpl._id, scheduledDate: today.getTime() });
      navigate(`/inventory/run/${runId}`);
    } catch (err: any) {
      // Backend also enforces single in-progress run per user
      alert(err?.message ?? "Failed to start check");
    }
  };

  return (
    <div className="space-y-3">
      {(!templates || templates.length === 0) && (
        <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
          <div className="p-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">No templates available. Contact an admin to create one.</p>
          </div>
        </div>
      )}

      {templates?.map((tpl) => {
        const run = inProgressRuns?.find((r) => r.templateId === tpl._id);
        const lastCompleted = lastCompletedRuns?.find((lc) => lc.templateId === tpl._id);
        const completedThisWeek = isCompletedThisWeek(lastCompleted?.lastCompletedAt);
        const hasUnpublished = !!tpl.hasUnpublishedChanges;

        return (
          <div
            key={tpl._id}
            className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-all"
          >
            {/* Header with Template Name and Status */}
            <div className="p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {tpl.name}
                    </h3>
                  </div>

                  {tpl.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {tpl.description}
                    </p>
                  )}

                  {/* Date Information */}
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        Last completed: {lastCompleted?.lastCompletedAt
                          ? formatRelativeTime(lastCompleted.lastCompletedAt)
                          : 'Never'
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Last updated: {formatRelativeTime(tpl.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex-shrink-0">
                  {run ? (
                    <Badge variant="secondary">
                      In Progress
                    </Badge>
                  ) : hasUnpublished ? (
                    <Badge variant="destructive">
                      Unpublished
                    </Badge>
                  ) : completedThisWeek ? (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600 dark:bg-green-600">
                      Completed
                    </Badge>
                  ) : (
                    <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 dark:bg-amber-600">
                      Due this week
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Footer with Action Button */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-3">
              <div>
                {run ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/inventory/run/${run._id}`)}
                  >
                    <PlayIcon className="h-4 w-4 mr-1.5" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleStartCheck(tpl)}
                    disabled={hasUnpublished}
                    className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                  >
                    <PlayIcon className="h-4 w-4 mr-1.5" />
                    {hasUnpublished ? 'Unavailable' : 'Start Check'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default InventoryTemplateSelector;
