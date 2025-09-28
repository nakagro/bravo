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
}

interface InProgressRunDoc {
  _id: Id<"applianceCheckRuns">;
  templateId: Id<"applianceTemplates">;
  templateName: string;
  templateVersion: number;
  status: "in_progress" | "completed" | "cancelled";
  startedAt: number;
}

export function TemplateSelector() {
  const templates = useQuery(api.applianceTemplates.getApplianceTemplates) as ApplianceTemplateDoc[] | undefined;
  const startRun = useMutation(api.applianceCheckRuns.startRun);
  const navigate = useNavigate();
  const inProgressRuns = useQuery(api.applianceCheckRuns.getInProgressRuns) as InProgressRunDoc[] | undefined;
  const lastCompletedRuns = useQuery(api.applianceCheckRuns.getLastCompletedRunsByTemplate);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    try {
      const runId = await startRun({ templateId: tpl._id, scheduledDate: today.getTime() });
      navigate(`/appliances/run/${runId}`);
    } catch (err: any) {
      // Backend also enforces single in-progress run per user
      alert(err?.message ?? "Failed to start check");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
      <div className="p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium">Start a Check</h3>
      </div>
      <div className="p-3">
        {(!templates || templates.length === 0) && (
          <div className="text-sm text-muted-foreground">No templates available. Contact an admin to create one.</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates?.map((tpl) => {
            const run = inProgressRuns?.find((r) => r.templateId === tpl._id);
            const lastCompleted = lastCompletedRuns?.find((lc) => lc.templateId === tpl._id);
            return (
            <div key={tpl._id} className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="p-3 flex flex-row items-center justify-between border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{tpl.name}</h4>
                  {tpl.hasUnpublishedChanges ? (
                    <Badge variant="destructive">Unpublished</Badge>
                  ) : null}
                  <Badge variant="outline">v{tpl.version}</Badge>
                </div>
                <div>
                  {run ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="uppercase tracking-wide">In progress</Badge>
                      <Button size="sm" onClick={() => navigate(`/appliances/run/${run._id}`)}>
                        Resume
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleStartCheck(tpl)}
                      disabled={!!tpl.hasUnpublishedChanges}
                    >
                      <PlayIcon className="h-4 w-4 mr-1" /> Start Check
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-3">
                {tpl.description ? (
                  <p className="text-sm text-muted-foreground mb-2">{tpl.description}</p>
                ) : null}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Last completed: {formatRelativeTime(lastCompleted?.lastCompletedAt)}
                  </p>
                  {isCompletedThisWeek(lastCompleted?.lastCompletedAt) ? (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-full">
                      ✓ This week
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 rounded-full">
                      ⚠ Due this week
                    </span>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TemplateSelector;
