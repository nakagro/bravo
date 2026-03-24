import { useMemo, useState, useEffect, useRef, useCallback } from "react";
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
  const sectionRefs = useRef<Map<number, HTMLElement>>(new Map());

  const grouped = useMemo((): GroupedSection[] => {
    const items = (runData?.items as RunItemDoc[]) ?? [];
    const map = new Map<number, { sectionName: string; items: RunItemDoc[] }>();
    for (const item of items) {
      const key = item.sectionOrder;
      if (!map.has(key)) map.set(key, { sectionName: item.sectionName, items: [] });
      map.get(key)!.items.push(item);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([order, { sectionName, items }]) => ({
        order,
        sectionName,
        items: items.sort((a, b) => a.itemOrder - b.itemOrder),
      }));
  }, [runData]);

  const run = runData?.run;
  const isReadOnly = run?.status !== "in_progress";

  const progress = useMemo((): ProgressInfo => {
    const items = (runData?.items as RunItemDoc[]) ?? [];
    const answered = items.filter(i => {
      if (i.expectedQuantity !== undefined) return i.actualQuantity !== undefined;
      return typeof i.value !== "undefined";
    }).length;
    const total = items.length;
    return { answered, total, percentage: total > 0 ? Math.round((answered / total) * 100) : 0 };
  }, [runData]);

  // Count deviations (No answers + quantity mismatches)
  const deviationCount = useMemo(() => {
    const items = (runData?.items as RunItemDoc[]) ?? [];
    return items.filter(i => {
      if (i.expectedQuantity !== undefined) {
        return i.actualQuantity !== undefined && i.actualQuantity !== i.expectedQuantity;
      }
      return i.value === "no";
    }).length;
  }, [runData]);

  // Auto-expand: track which sections are open
  // Start with all open, then auto-open next unanswered when a section completes
  const [openSections, setOpenSections] = useState<string[]>([]);
  const prevProgressRef = useRef<Map<number, number>>(new Map());

  // Initialize open sections when data loads
  useEffect(() => {
    if (grouped.length > 0 && openSections.length === 0) {
      setOpenSections(grouped.map(s => `section-${s.order}`));
    }
  }, [grouped, openSections.length]);

  // Auto-expand next section when one completes
  useEffect(() => {
    if (isReadOnly || grouped.length === 0) return;

    for (const section of grouped) {
      const answered = section.items.filter(i => {
        if (i.expectedQuantity !== undefined) return i.actualQuantity !== undefined;
        return typeof i.value !== "undefined";
      }).length;
      const total = section.items.length;
      const prevAnswered = prevProgressRef.current.get(section.order) ?? 0;

      // Section just completed
      if (answered === total && prevAnswered < total) {
        // Find next incomplete section
        const nextIncomplete = grouped.find(s => {
          if (s.order <= section.order) return false;
          const a = s.items.filter(i => {
            if (i.expectedQuantity !== undefined) return i.actualQuantity !== undefined;
            return typeof i.value !== "undefined";
          }).length;
          return a < s.items.length;
        });

        if (nextIncomplete) {
          const nextKey = `section-${nextIncomplete.order}`;
          setOpenSections(prev => {
            if (prev.includes(nextKey)) return prev;
            return [...prev, nextKey];
          });
          // Scroll to next section
          setTimeout(() => {
            const el = sectionRefs.current.get(nextIncomplete.order);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 200);
        }
      }

      prevProgressRef.current.set(section.order, answered);
    }
  }, [grouped, isReadOnly]);

  const handleNavigateSection = useCallback((sectionOrder: number) => {
    const key = `section-${sectionOrder}`;
    setOpenSections(prev => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
    setTimeout(() => {
      const el = sectionRefs.current.get(sectionOrder);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }, []);

  const handleComplete = async () => {
    if (!run) return;
    const items = (runData?.items as RunItemDoc[] | undefined) ?? [];

    const unanswered = items.filter(i => {
      if (i.expectedQuantity !== undefined) return i.actualQuantity === undefined;
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
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 dark:border-red-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      <InventoryCheckHeader
        templateName={run.templateName}
        status={run.status}
        progress={progress}
        deviationCount={deviationCount}
        isReadOnly={isReadOnly}
        completing={completing}
        cancelling={cancelling}
        onComplete={handleComplete}
        onCancel={handleCancel}
        onExportPdf={handleExportPdf}
        sections={grouped}
        onNavigateSection={handleNavigateSection}
      />

      {isReadOnly && runData?.items && (
        <InventoryExecutiveSummary items={runData.items as RunItemDoc[]} />
      )}

      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-3"
      >
        {grouped.map((section) => (
          <div
            key={section.order}
            ref={(el) => {
              if (el) sectionRefs.current.set(section.order, el);
              else sectionRefs.current.delete(section.order);
            }}
          >
            <InventoryCheckSection
              section={section}
              isReadOnly={isReadOnly}
            />
          </div>
        ))}
      </Accordion>
    </div>
  );
}

export default InventoryChecksTab;
