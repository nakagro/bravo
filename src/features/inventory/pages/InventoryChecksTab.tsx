import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Card, CardContent } from "../../../components/ui/card";
import { Accordion } from "../../../components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import {
  ChecklistActionBar,
  ChecklistProgressHeader,
  summariseChecklist,
  useChecklistNavigation,
} from "@/components/shared/checklist";
import { InventoryCheckHeader } from "../components/InventoryCheckHeader";
import { InventoryCheckSection } from "../components/InventoryCheckSection";
import { InventoryExecutiveSummary } from "../components/InventoryExecutiveSummary";
import { exportCheckToPdf } from "../utils/exportCheckToPdf";
import {
  hasQuantityMismatch,
  inventoryItemStatus,
  isInventoryItemAnswered,
} from "../utils/inventoryStatus";
import type { RunItemDoc, GroupedSection } from "../types/inventory.types";

const sectionKey = (order: number) => `section-${order}`;

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
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  const items = useMemo(
    () => (runData?.items as RunItemDoc[] | undefined) ?? [],
    [runData]
  );

  const grouped = useMemo((): GroupedSection[] => {
    const map = new Map<number, { sectionName: string; items: RunItemDoc[] }>();
    for (const item of items) {
      const key = item.sectionOrder;
      if (!map.has(key)) map.set(key, { sectionName: item.sectionName, items: [] });
      map.get(key)!.items.push(item);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([order, { sectionName, items: sectionItems }]) => ({
        order,
        sectionName,
        items: sectionItems.sort((a, b) => a.itemOrder - b.itemOrder),
      }));
  }, [items]);

  const run = runData?.run;
  const isReadOnly = run?.status !== "in_progress";

  const progress = useMemo(
    () => summariseChecklist(items.map(inventoryItemStatus)),
    [items]
  );

  const sectionProgress = useMemo(
    () =>
      grouped.map((section) => ({
        section,
        progress: summariseChecklist(section.items.map(inventoryItemStatus)),
      })),
    [grouped]
  );

  const navSections = useMemo(
    () =>
      sectionProgress.map(({ section, progress: p }) => ({
        key: sectionKey(section.order),
        answered: p.answered,
        total: p.total,
      })),
    [sectionProgress]
  );

  const { registerSectionRef, openSections, setOpenSections } =
    useChecklistNavigation({ sections: navSections, autoAdvance: !isReadOnly });

  const unanswered = items.filter((i) => !isInventoryItemAnswered(i));
  const mismatches = items.filter(hasQuantityMismatch);

  const runComplete = async () => {
    if (!run) return;
    setCompleting(true);
    try {
      await completeRun({ runId: run._id });
      toast.success("Inventory check completed");
      navigate("/inventory");
    } catch (error) {
      console.error("Error completing inventory check:", error);
      toast.error("Failed to complete inventory check", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleComplete = () => {
    if (!run) return;
    // One dialog stating everything outstanding, rather than two native
    // confirm() prompts back to back.
    if (unanswered.length > 0 || mismatches.length > 0) {
      setShowCompleteConfirm(true);
      return;
    }
    void runComplete();
  };

  const handleCancel = async () => {
    if (!run) return;
    setCancelling(true);
    try {
      await cancelRun({ runId: run._id });
      toast.success("Inventory check cancelled");
      navigate("/inventory");
    } catch (error) {
      console.error("Error cancelling inventory check:", error);
      toast.error("Failed to cancel inventory check", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleExportPdf = () => {
    if (!run || items.length === 0) return;

    const startedByName = runData?.startedByUser
      ? `${runData.startedByUser.firstName || ""} ${runData.startedByUser.lastName || ""}`.trim() || runData.startedByUser.name || "Unknown"
      : undefined;

    const completedByName = runData?.completedByUser
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
      items,
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

  const completeConfirmDescription = [
    unanswered.length > 0
      ? `${unanswered.length} item${unanswered.length !== 1 ? "s" : ""} ${unanswered.length !== 1 ? "have" : "has"} not been checked.`
      : null,
    mismatches.length > 0
      ? `${mismatches.length} item${mismatches.length !== 1 ? "s" : ""} ${mismatches.length !== 1 ? "have" : "has"} a quantity mismatch (${mismatches.map((i) => i.itemName).join(", ")}). Consider adding notes to explain the discrepancy.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-3 pb-4">
      <InventoryCheckHeader
        templateName={run.templateName}
        status={run.status}
        isReadOnly={isReadOnly}
        cancelling={cancelling}
        onCancel={() => void handleCancel()}
        onExportPdf={handleExportPdf}
      />

      <ChecklistProgressHeader progress={progress} />

      {isReadOnly && items.length > 0 && (
        <InventoryExecutiveSummary items={items} />
      )}

      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-3"
      >
        {sectionProgress.map(({ section }) => (
          <InventoryCheckSection
            key={section.order}
            ref={registerSectionRef(sectionKey(section.order))}
            section={section}
            isReadOnly={isReadOnly}
          />
        ))}
      </Accordion>

      <ChecklistActionBar
        state={isReadOnly ? "completed" : "editable"}
        primaryLabel="Complete Check"
        onPrimary={handleComplete}
        // Inventory can finish early — the outstanding items are surfaced in a
        // confirmation dialog rather than gating the button.
        primaryDisabled={false}
        isSubmitting={completing}
        completedLabel={
          run.status === "cancelled" ? "Check cancelled" : "Check completed"
        }
      />

      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this check anyway?</AlertDialogTitle>
            <AlertDialogDescription>
              {completeConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">
              Keep Checking
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto"
              onClick={() => {
                setShowCompleteConfirm(false);
                void runComplete();
              }}
            >
              Complete anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default InventoryChecksTab;
