import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";

interface RunItemDoc {
  _id: Id<"applianceCheckRunItems">;
  runId: Id<"applianceCheckRuns">;
  templateId: Id<"applianceTemplates">;
  sectionId?: Id<"applianceSections">;
  itemId?: Id<"applianceItems">;
  sectionName: string;
  sectionOrder: number;
  itemName: string;
  itemOrder: number;
  itemType: "boolean_with_notes" | "boolean" | "text";
  value?: "yes" | "no";
  notes?: string;
}

export function ApplianceChecksTab() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const runData = useQuery(
    api.applianceCheckRuns.getRun,
    runId ? { runId: runId as Id<"applianceCheckRuns"> } : "skip"
  );
  const updateItem = useMutation(api.applianceCheckRuns.updateRunItem);
  const completeRun = useMutation(api.applianceCheckRuns.completeRun);

  const [completing, setCompleting] = useState(false);

  const grouped = useMemo(() => {
    const items = (runData?.items as RunItemDoc[]) ?? [];
    const map = new Map<number, { sectionName: string; items: RunItemDoc[] }>();
    for (const item of items) {
      const key = item.sectionOrder;
      if (!map.has(key)) map.set(key, { sectionName: item.sectionName, items: [] });
      map.get(key)!.items.push(item);
    }
    // Sort sections and items
    const sections = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([order, { sectionName, items }]) => ({
        order,
        sectionName,
        items: items.sort((a, b) => a.itemOrder - b.itemOrder),
      }));
    return sections;
  }, [runData]);

  const run = runData?.run;

  const isReadOnly = run?.status !== "in_progress";

  const handleSetValue = async (runItemId: Id<"applianceCheckRunItems">, value: "yes" | "no") => {
    if (isReadOnly) return;
    await updateItem({ runItemId, value });
  };

  const handleSaveNotes = async (runItemId: Id<"applianceCheckRunItems">, notes: string) => {
    if (isReadOnly) return;
    await updateItem({ runItemId, notes });
  };

  const handleComplete = async () => {
    if (!run) return;
    const unanswered = (runData?.items as RunItemDoc[] | undefined)?.filter(i => typeof i.value === "undefined");
    if (unanswered && unanswered.length > 0) {
      const proceed = confirm(`There are ${unanswered.length} unchecked items. Complete anyway?`);
      if (!proceed) return;
    }
    setCompleting(true);
    try {
      await completeRun({ runId: run._id });
      navigate("/appliances");
    } finally {
      setCompleting(false);
    }
  };

  if (!run) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 text-sm text-muted-foreground">Loading run...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="p-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium">{run.templateName}</h2>
            <Badge variant={run.status === "in_progress" ? "secondary" : "outline"}>{run.status}</Badge>
            <Badge variant="outline">v{run.templateVersion}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>
            <Button onClick={handleComplete} disabled={completing || isReadOnly}>
              {completing ? "Completing..." : "Complete"}
            </Button>
          </div>
        </div>
      </div>

      {/* Sections and Items */}
      {grouped.map((section) => (
        <div key={section.order} className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
          <div className="p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium">{section.sectionName}</h3>
          </div>
          <div className="p-3 space-y-3">
            {section.items.map((item) => (
              <div key={item._id} className="border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{item.itemName}</div>
                  <div className="flex gap-2">
                    <Button
                      variant={item.value === "yes" ? "default" : "secondary"}
                      size="sm"
                      onClick={() => handleSetValue(item._id, "yes")}
                      disabled={isReadOnly}
                    >
                      ✓ Yes
                    </Button>
                    <Button
                      variant={item.value === "no" ? "destructive" : "secondary"}
                      size="sm"
                      onClick={() => handleSetValue(item._id, "no")}
                      disabled={isReadOnly}
                    >
                      ✕ No
                    </Button>
                  </div>
                </div>
                {(item.itemType === "boolean_with_notes" || item.itemType === "text") && (
                  <div className="mt-2">
                    <Textarea
                      defaultValue={item.notes ?? ""}
                      placeholder="Notes (optional)"
                      onBlur={(e) => handleSaveNotes(item._id, e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ApplianceChecksTab;
