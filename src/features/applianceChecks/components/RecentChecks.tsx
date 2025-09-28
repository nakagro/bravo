import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { useNavigate } from "react-router-dom";

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
}

function formatDate(ts?: number) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString();
}

export function RecentChecks() {
  const summaries = useQuery(api.applianceCheckRuns.listRunSummaries, { limit: 10 }) as RunSummary[] | undefined;
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
      <div className="p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium">History</h3>
      </div>
      <div className="p-3">
        {(!summaries || summaries.length === 0) && (
          <div className="text-sm text-muted-foreground">No runs yet.</div>
        )}
        <div className="space-y-3">
          {summaries?.map((s) => (
            <div key={s.run._id} className="border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {s.run.templateName}
                  <Badge variant="outline">v{s.run.templateVersion}</Badge>
                  <Badge variant={s.run.status === "completed" ? "secondary" : "outline"}>{s.run.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Started: {formatDate(s.run.startedAt)}
                  {s.run.completedAt ? ` · Completed: ${formatDate(s.run.completedAt)}` : ""}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {s.yes} Yes · {s.no} No · {s.unanswered} Unanswered (Total {s.total})
                </div>
              </div>
              <div>
                <Button size="sm" onClick={() => navigate(`/appliances/run/${s.run._id}`)}>View</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RecentChecks;
