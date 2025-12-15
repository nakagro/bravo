import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Card, CardContent } from "../../../components/ui/card";
import { Accordion } from "../../../components/ui/accordion";
import { InventoryCheckHeader } from "../components/InventoryCheckHeader";
import { InventoryCheckSection } from "../components/InventoryCheckSection";
import { InventoryExecutiveSummary } from "../components/InventoryExecutiveSummary";
import { exportCheckToPdf } from "../utils/exportCheckToPdf";
import type { RunItemDoc, GroupedSection, ProgressInfo } from "../types/inventory.types";

export function InventoryChecksTab() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const runData = useQuery(
    api.inventoryCheckRuns.getRun,
    runId ? { runId: runId as Id<"applianceCheckRuns"> } : "skip"
  );
  const completeRun = useMutation(api.inventoryCheckRuns.completeRun);
  const cancelRun = useMutation(api.inventoryCheckRuns.cancelRun);

  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const grouped = useMemo((): GroupedSection[] => {
    const items = (runData?.items as RunItemDoc[]) ?? [];
    const map = new Map<number, { sectionName: string; items: RunItemDoc[] }>();
    for (const item of items) {
      const key = item.sectionOrder;
      if (!map.has(key)) map.set(key, { sectionName: item.sectionName, items: [] });
      map.get(key)!.items.push(item);
    }
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

  const progress = useMemo((): ProgressInfo => {
    const items = (runData?.items as RunItemDoc[]) ?? [];
    const answered = items.filter(i => {
      if (i.expectedQuantity !== undefined) {
        return i.actualQuantity !== undefined;
      }
      return typeof i.value !== "undefined";
    }).length;
    const total = items.length;
    return { answered, total, percentage: total > 0 ? Math.round((answered / total) * 100) : 0 };
  }, [runData]);

  const handleComplete = async () => {
    if (!run) return;
    const items = (runData?.items as RunItemDoc[] | undefined) ?? [];

    const unanswered = items.filter(i => {
      if (i.expectedQuantity !== undefined) {
        return i.actualQuantity === undefined;
      }
      return typeof i.value === "undefined";
    });

    if (unanswered.length > 0) {
      const proceed = confirm(`There are ${unanswered.length} unchecked items. Complete anyway?`);
      if (!proceed) return;
    }

    const mismatches = items.filter(i =>
      i.expectedQuantity !== undefined &&
      i.actualQuantity !== undefined &&
      i.actualQuantity !== i.expectedQuantity
    );

    if (mismatches.length > 0) {
      const mismatchNames = mismatches.map(i => i.itemName).join(", ");
      const proceed = confirm(
        `Warning: ${mismatches.length} item(s) have quantity mismatches (${mismatchNames}). ` +
        `Consider adding notes to explain the discrepancy. Complete anyway?`
      );
      if (!proceed) return;
    }

    setCompleting(true);
    try {
      await completeRun({ runId: run._id });
      navigate("/inventory");
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!run) return;
    setCancelling(true);
    try {
      await cancelRun({ runId: run._id });
      navigate("/inventory");
    } finally {
      setCancelling(false);
    }
  };

  const handleExportPdf = () => {
    if (!run || !runData?.items) return;
    
    const startedByName = runData.startedByUser 
      ? `${runData.startedByUser.firstName || ""} ${runData.startedByUser.lastName || ""}`.trim() || runData.startedByUser.name || "Unknown"
      : undefined;
    
    const completedByName = runData.completedByUser
      ? `${runData.completedByUser.firstName || ""} ${runData.completedByUser.lastName || ""}`.trim() || runData.completedByUser.name || "Unknown"
      : undefined;

    exportCheckToPdf({
      run: {
        templateName: run.templateName,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        notes: run.notes,
        startedByName,
        completedByName,
      },
      items: runData.items as RunItemDoc[],
      groupedSections: grouped,
    });
  };

  if (!run) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-sm text-muted-foreground">Loading run...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <InventoryCheckHeader
        templateName={run.templateName}
        status={run.status}
        progress={progress}
        isReadOnly={isReadOnly}
        completing={completing}
        cancelling={cancelling}
        onComplete={handleComplete}
        onCancel={handleCancel}
        onExportPdf={handleExportPdf}
      />

      {isReadOnly && runData?.items && (
        <InventoryExecutiveSummary items={runData.items as RunItemDoc[]} />
      )}

      <Accordion type="multiple" defaultValue={grouped.map(s => `section-${s.order}`)} className="space-y-4">
        {grouped.map((section) => (
          <InventoryCheckSection
            key={section.order}
            section={section}
            isReadOnly={isReadOnly}
          />
        ))}
      </Accordion>
    </div>
  );
}

export default InventoryChecksTab;
