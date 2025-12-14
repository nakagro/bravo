import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../../components/ui/accordion";
import { CheckCircle2, XCircle, ArrowLeft, CheckCheck, MessageSquarePlus, Info, Ban, AlertTriangle, FileText, Hash } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../../components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";

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
  description?: string;
  imageStorageId?: Id<"_storage">;
  expectedQuantity?: number;
  actualQuantity?: number;
}

interface DeviationItem {
  item: RunItemDoc;
  deviationType: "no" | "quantity_mismatch" | "notes_only";
  quantityDiff?: number;
}

// Executive Summary component for read-only completed checks
function ExecutiveSummary({ items }: { items: RunItemDoc[] }) {
  const deviations = useMemo(() => {
    const result: DeviationItem[] = [];
    
    for (const item of items) {
      const hasNotes = item.notes && item.notes.trim().length > 0;
      const isNo = item.value === "no";
      const hasQuantityMismatch = item.expectedQuantity !== undefined && 
        item.actualQuantity !== undefined && 
        item.actualQuantity !== item.expectedQuantity;
      
      if (isNo) {
        result.push({ item, deviationType: "no" });
      } else if (hasQuantityMismatch) {
        result.push({ 
          item, 
          deviationType: "quantity_mismatch",
          quantityDiff: item.actualQuantity! - item.expectedQuantity!
        });
      } else if (hasNotes) {
        result.push({ item, deviationType: "notes_only" });
      }
    }
    
    return result;
  }, [items]);

  const noCount = deviations.filter(d => d.deviationType === "no").length;
  const quantityCount = deviations.filter(d => d.deviationType === "quantity_mismatch").length;
  const notesOnlyCount = deviations.filter(d => d.deviationType === "notes_only").length;

  if (deviations.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-300">All Items OK</h3>
              <p className="text-sm text-green-700 dark:text-green-400">All {items.length} items passed with no issues or notes.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300">Items Requiring Attention</h3>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {deviations.length} item{deviations.length !== 1 ? "s" : ""} deviated from expected
              {noCount > 0 && <span className="ml-2">• {noCount} marked No</span>}
              {quantityCount > 0 && <span className="ml-2">• {quantityCount} quantity adjusted</span>}
              {notesOnlyCount > 0 && <span className="ml-2">• {notesOnlyCount} with notes</span>}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-2">
          {deviations.map((deviation) => (
            <div 
              key={deviation.item._id} 
              className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/50"
            >
              {/* Icon based on deviation type */}
              <div className="flex-shrink-0 mt-0.5">
                {deviation.deviationType === "no" && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                {deviation.deviationType === "quantity_mismatch" && (
                  <Hash className="w-5 h-5 text-amber-500" />
                )}
                {deviation.deviationType === "notes_only" && (
                  <FileText className="w-5 h-5 text-blue-500" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {deviation.item.itemName}
                  </span>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {deviation.item.sectionName}
                  </Badge>
                  {deviation.deviationType === "no" && (
                    <Badge variant="destructive" className="text-xs">No</Badge>
                  )}
                  {deviation.deviationType === "quantity_mismatch" && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs font-semibold ${
                        deviation.quantityDiff! > 0 
                          ? "border-green-500 text-green-600 dark:text-green-500" 
                          : "border-red-500 text-red-600 dark:text-red-500"
                      }`}
                    >
                      {deviation.quantityDiff! > 0 ? "+" : ""}{deviation.quantityDiff}
                      <span className="ml-1 font-normal">
                        ({deviation.item.actualQuantity}/{deviation.item.expectedQuantity})
                      </span>
                    </Badge>
                  )}
                </div>
                {deviation.item.notes && (
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                    {deviation.item.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Component to display item info (description + image)
function ItemInfoButton({ item }: { item: RunItemDoc }) {
  const imageUrl = useQuery(
    api.inventoryTemplates.getImageUrl,
    item.imageStorageId ? { storageId: item.imageStorageId } : "skip"
  );

  const hasInfo = item.description || item.imageStorageId;

  if (!hasInfo) {
    return null; // No info to show
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 shrink-0 min-h-[44px] min-w-[44px] p-2"
          title="View item details"
        >
          <Info className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.itemName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {item.description && (
            <div>
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {item.description}
              </p>
            </div>
          )}
          {imageUrl && (
            <div>
              <h4 className="text-sm font-medium mb-2">Reference Image</h4>
              <img
                src={imageUrl}
                alt={item.itemName}
                className="w-full rounded-lg border"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryChecksTab() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const runData = useQuery(
    api.inventoryCheckRuns.getRun,
    runId ? { runId: runId as Id<"applianceCheckRuns"> } : "skip"
  );
  const updateItem = useMutation(api.inventoryCheckRuns.updateRunItem);
  const completeRun = useMutation(api.inventoryCheckRuns.completeRun);
  const cancelRun = useMutation(api.inventoryCheckRuns.cancelRun);

  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showQuantityInput, setShowQuantityInput] = useState<Set<string>>(new Set());
  const [showNotesModal, setShowNotesModal] = useState<Set<string>>(new Set());

  const toggleQuantityInput = (itemId: string) => {
    setShowQuantityInput(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

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

  // Calculate progress
  const progress = useMemo(() => {
    const items = (runData?.items as RunItemDoc[]) ?? [];
    const answered = items.filter(i => {
      // For quantity items, check if actualQuantity is set
      if (i.expectedQuantity !== undefined) {
        return i.actualQuantity !== undefined;
      }
      // For boolean items, check if value is set
      return typeof i.value !== "undefined";
    }).length;
    const total = items.length;
    return { answered, total, percentage: total > 0 ? Math.round((answered / total) * 100) : 0 };
  }, [runData]);

  const handleSetValue = async (runItemId: Id<"applianceCheckRunItems">, value: "yes" | "no", expectedQuantity?: number) => {
    if (isReadOnly) return;
    if (expectedQuantity !== undefined) {
      const actualQuantity = value === "yes" ? expectedQuantity : 0;
      await updateItem({ runItemId, actualQuantity });
      return;
    }

    await updateItem({ runItemId, value });
  };

  const handleSaveNotes = async (runItemId: Id<"applianceCheckRunItems">, notes: string) => {
    if (isReadOnly) return;
    await updateItem({ runItemId, notes });
  };

  const handleComplete = async () => {
    if (!run) return;
    const items = (runData?.items as RunItemDoc[] | undefined) ?? [];

    // Check for unanswered items (both boolean and quantity)
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

    // Check for quantity mismatches
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
      {/* Sticky Header */}
      <Card className="sticky top-0 z-10 shadow-md">
        <CardHeader className="p-4 pb-3">
          <div className="flex flex-col gap-3">
            {/* Title and Badges Row */}
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg sm:text-xl">{run.templateName}</CardTitle>
              {run.status === "in_progress" ? (
                <Badge variant="secondary" className="bg-gray-600 hover:bg-gray-700 text-white dark:bg-gray-600">
                  In Progress
                </Badge>
              ) : run.status === "completed" ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-600">
                  Completed
                </Badge>
              ) : (
                <Badge variant="outline">
                  {run.status}
                </Badge>
              )}
            </div>

            {/* Progress Bar */}
            {!isReadOnly && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {progress.answered} / {progress.total} ({progress.percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1 sm:flex-none"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              {!isReadOnly && (
                <>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={cancelling}
                        className="flex-1 sm:flex-none text-destructive hover:text-destructive border-destructive/50 hover:border-destructive hover:bg-destructive/10"
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        {cancelling ? "Cancelling..." : "Cancel"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Inventory Check?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to cancel this inventory check? All progress will be lost and this action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                        <AlertDialogCancel className="w-full sm:w-auto">Keep Checking</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancel}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                        >
                          Yes, Cancel Check
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    onClick={handleComplete}
                    disabled={completing}
                    className="flex-1 sm:flex-none"
                  >
                    <CheckCheck className="w-4 h-4 mr-2" />
                    {completing ? "Completing..." : "Complete Check"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Executive Summary - only shown for completed/read-only checks */}
      {isReadOnly && runData?.items && (
        <ExecutiveSummary items={runData.items as RunItemDoc[]} />
      )}

      {/* Sections and Items */}
      <Accordion type="multiple" defaultValue={grouped.map(s => `section-${s.order}`)} className="space-y-4">
        {grouped.map((section) => {
          const sectionAnswered = section.items.filter(i => {
            // For quantity items, check if actualQuantity is set
            if (i.expectedQuantity !== undefined) {
              return i.actualQuantity !== undefined;
            }
            // For boolean items, check if value is set
            return typeof i.value !== "undefined";
          }).length;
          const sectionTotal = section.items.length;
          const sectionPercentage = sectionTotal > 0 ? Math.round((sectionAnswered / sectionTotal) * 100) : 0;

          return (
            <AccordionItem key={section.order} value={`section-${section.order}`} className="border-none">
              <Card>
                <CardHeader className="p-4 pb-0 bg-muted/50">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center justify-between flex-1 pr-2">
                      <CardTitle className="text-base sm:text-lg">{section.sectionName}</CardTitle>
                      <Badge variant="secondary" className="ml-2">
                        {sectionAnswered}/{sectionTotal} ({sectionPercentage}%)
                      </Badge>
                    </div>
                  </AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="p-4 pt-4 space-y-3">
                    {section.items.map((item) => {
                      const hasNotes = item.notes && item.notes.trim().length > 0;

                      return (
                        <Card key={item._id}>
                          <CardContent className="p-4 space-y-3">
                            {/* Item Name */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium text-sm sm:text-base">
                                {item.expectedQuantity
                                  ? `${item.actualQuantity !== undefined ? item.actualQuantity : item.expectedQuantity}x ${item.itemName}`
                                  : item.itemName}
                              </div>
                              <ItemInfoButton item={item} />
                              {/* Show badge if quantity mismatch */}
                              {item.expectedQuantity && item.actualQuantity !== undefined && item.actualQuantity !== item.expectedQuantity && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-semibold ${item.actualQuantity > item.expectedQuantity
                                    ? "border-green-500 text-green-600 dark:text-green-500"
                                    : "border-red-500 text-red-600 dark:text-red-500"
                                    }`}
                                >
                                  {item.actualQuantity > item.expectedQuantity ? "+" : ""}{item.actualQuantity - item.expectedQuantity}
                                </Badge>
                              )}
                            </div>

                            {/* Yes/No Response Buttons */}
                            {item.expectedQuantity ? (
                              <>
                                {/* Quantity Check - Yes/No Buttons */}
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <Button
                                    variant={
                                      item.actualQuantity !== undefined && item.actualQuantity === item.expectedQuantity
                                        ? "default"
                                        : "outline"
                                    }
                                    size="lg"
                                    onClick={() => handleSetValue(item._id, "yes", item.expectedQuantity)}
                                    disabled={isReadOnly}
                                    className={`flex-1 min-h-[44px] ${item.actualQuantity !== undefined && item.actualQuantity === item.expectedQuantity
                                      ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                                      : "hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 hover:text-green-700 dark:hover:text-green-400"
                                      }`}
                                  >
                                    <span className="font-medium">Yes</span>
                                  </Button>
                                  <Button
                                    variant={item.actualQuantity === 0 ? "destructive" : "outline"}
                                    size="lg"
                                    onClick={() => handleSetValue(item._id, "no", item.expectedQuantity)}
                                    disabled={isReadOnly}
                                    className={`flex-1 min-h-[44px] ${item.actualQuantity === 0
                                      ? ""
                                      : "hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 dark:hover:text-red-400"
                                      }`}
                                  >
                                    <span className="font-medium">No</span>
                                  </Button>
                                </div>

                                {/* Action Buttons Row - Aligned Right */}
                                {!isReadOnly && (
                                  <div className="flex gap-2 justify-end">
                                    <Dialog open={showQuantityInput.has(item._id)} onOpenChange={(open) => {
                                      if (!open) {
                                        setShowQuantityInput(prev => {
                                          const next = new Set(prev);
                                          next.delete(item._id);
                                          return next;
                                        });
                                      }
                                    }}>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant={
                                            item.actualQuantity !== undefined &&
                                              item.actualQuantity !== item.expectedQuantity &&
                                              item.actualQuantity !== 0
                                              ? "default"
                                              : "outline"
                                          }
                                          size="sm"
                                          onClick={() => toggleQuantityInput(item._id)}
                                          className={`gap-1.5 ${item.actualQuantity !== undefined &&
                                            item.actualQuantity !== item.expectedQuantity &&
                                            item.actualQuantity !== 0
                                            ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
                                            : "hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-700 dark:hover:text-amber-400"
                                            }`}
                                          title="Adjust quantity"
                                        >
                                          <span className="text-lg leading-none">±</span>
                                          <span className="text-sm">Adjust</span>
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                          <DialogTitle>Adjust Quantity: {item.itemName}</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <div className="flex items-center gap-2 text-sm">
                                            <span className="text-muted-foreground">Expected:</span>
                                            <span className="font-semibold text-base">{item.expectedQuantity}</span>
                                          </div>
                                          <div className="space-y-2">
                                            <label className="text-sm font-medium">Actual Count:</label>
                                            <Input
                                              id={`quantity-${item._id}`}
                                              type="number"
                                              min="0"
                                              step="1"
                                              defaultValue={item.actualQuantity ?? ""}
                                              onKeyDown={(e) => {
                                                if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                                                  e.preventDefault();
                                                }
                                              }}
                                              placeholder="Enter count..."
                                              className="text-lg"
                                            />
                                          </div>
                                          {item.actualQuantity !== undefined && item.actualQuantity !== item.expectedQuantity && (
                                            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                                              <XCircle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                                              <span className="text-sm font-medium text-amber-600 dark:text-amber-500">
                                                Current Difference: {item.actualQuantity > item.expectedQuantity ? "+" : ""}{item.actualQuantity - item.expectedQuantity}
                                              </span>
                                            </div>
                                          )}
                                          <div className="flex gap-2 justify-end">
                                            <Button
                                              variant="outline"
                                              onClick={() => {
                                                setShowQuantityInput(prev => {
                                                  const next = new Set(prev);
                                                  next.delete(item._id);
                                                  return next;
                                                });
                                              }}
                                            >
                                              Cancel
                                            </Button>
                                            <Button
                                              onClick={() => {
                                                const input = document.getElementById(`quantity-${item._id}`) as HTMLInputElement;
                                                if (input) {
                                                  const inputValue = input.value;
                                                  if (inputValue === "") {
                                                    updateItem({ runItemId: item._id, actualQuantity: null, value: null });
                                                  } else {
                                                    const value = parseInt(inputValue, 10);
                                                    if (!isNaN(value) && value >= 0 && Number.isInteger(value)) {
                                                      updateItem({ runItemId: item._id, actualQuantity: value, value: null });
                                                    }
                                                  }
                                                }
                                                setShowQuantityInput(prev => {
                                                  const next = new Set(prev);
                                                  next.delete(item._id);
                                                  return next;
                                                });
                                              }}
                                            >
                                              Save Quantity
                                            </Button>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>

                                    <Dialog open={showNotesModal.has(item._id)} onOpenChange={(open) => {
                                      setShowNotesModal(prev => {
                                        const next = new Set(prev);
                                        if (open) {
                                          next.add(item._id);
                                        } else {
                                          next.delete(item._id);
                                        }
                                        return next;
                                      });
                                    }}>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-1.5 hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-400"
                                        >
                                          <MessageSquarePlus className="w-4 h-4" />
                                          <span className="text-sm">Note</span>
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                          <DialogTitle>Notes: {item.itemName}</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <Textarea
                                            id={`notes-${item._id}`}
                                            defaultValue={item.notes ?? ""}
                                            placeholder="Add notes (optional)..."
                                            className="min-h-[120px]"
                                          />
                                          <div className="flex gap-2 justify-end">
                                            <Button
                                              variant="outline"
                                              onClick={() => {
                                                setShowNotesModal(prev => {
                                                  const next = new Set(prev);
                                                  next.delete(item._id);
                                                  return next;
                                                });
                                              }}
                                            >
                                              Cancel
                                            </Button>
                                            <Button
                                              onClick={() => {
                                                const textarea = document.getElementById(`notes-${item._id}`) as HTMLTextAreaElement;
                                                if (textarea) {
                                                  handleSaveNotes(item._id, textarea.value);
                                                }
                                                setShowNotesModal(prev => {
                                                  const next = new Set(prev);
                                                  next.delete(item._id);
                                                  return next;
                                                });
                                              }}
                                            >
                                              Save Notes
                                            </Button>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {/* Boolean Check - Yes/No Buttons */}
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <Button
                                    variant={item.value === "yes" ? "default" : "outline"}
                                    size="lg"
                                    onClick={() => handleSetValue(item._id, "yes")}
                                    disabled={isReadOnly}
                                    className={`flex-1 min-h-[44px] ${item.value === "yes"
                                      ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                                      : "hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 hover:text-green-700 dark:hover:text-green-400"
                                      }`}
                                  >
                                    <span className="font-medium">Yes</span>
                                  </Button>
                                  <Button
                                    variant={item.value === "no" ? "destructive" : "outline"}
                                    size="lg"
                                    onClick={() => handleSetValue(item._id, "no")}
                                    disabled={isReadOnly}
                                    className={`flex-1 min-h-[44px] ${item.value === "no"
                                      ? ""
                                      : "hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 dark:hover:text-red-400"
                                      }`}
                                  >
                                    <span className="font-medium">No</span>
                                  </Button>
                                </div>

                                {/* Action Buttons Row - Aligned Right */}
                                {!isReadOnly && (
                                  <div className="flex gap-2 justify-end">
                                    <Dialog open={showNotesModal.has(item._id)} onOpenChange={(open) => {
                                      setShowNotesModal(prev => {
                                        const next = new Set(prev);
                                        if (open) {
                                          next.add(item._id);
                                        } else {
                                          next.delete(item._id);
                                        }
                                        return next;
                                      });
                                    }}>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-1.5 hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-400"
                                        >
                                          <MessageSquarePlus className="w-4 h-4" />
                                          <span className="text-sm">Note</span>
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                          <DialogTitle>Notes: {item.itemName}</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <Textarea
                                            id={`notes-${item._id}`}
                                            defaultValue={item.notes ?? ""}
                                            placeholder="Add notes (optional)..."
                                            className="min-h-[120px]"
                                          />
                                          <div className="flex gap-2 justify-end">
                                            <Button
                                              variant="outline"
                                              onClick={() => {
                                                setShowNotesModal(prev => {
                                                  const next = new Set(prev);
                                                  next.delete(item._id);
                                                  return next;
                                                });
                                              }}
                                            >
                                              Cancel
                                            </Button>
                                            <Button
                                              onClick={() => {
                                                const textarea = document.getElementById(`notes-${item._id}`) as HTMLTextAreaElement;
                                                if (textarea) {
                                                  handleSaveNotes(item._id, textarea.value);
                                                }
                                                setShowNotesModal(prev => {
                                                  const next = new Set(prev);
                                                  next.delete(item._id);
                                                  return next;
                                                });
                                              }}
                                            >
                                              Save Notes
                                            </Button>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Show note content below buttons if exists */}
                            {hasNotes && (
                              <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                                <MessageSquarePlus className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span className="whitespace-pre-wrap">{item.notes}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

export default InventoryChecksTab;
