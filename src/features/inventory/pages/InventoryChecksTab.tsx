import React, { useMemo, useState } from "react";
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
import { CheckCircle2, XCircle, ArrowLeft, CheckCheck, MessageSquarePlus, Info } from "lucide-react";
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

  const [completing, setCompleting] = useState(false);
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
    // For quantity items, "yes" means all present, "no" means none found
    if (expectedQuantity !== undefined) {
      const actualQuantity = value === "yes" ? expectedQuantity : 0;
      await updateItem({ runItemId, value, actualQuantity });
    } else {
      await updateItem({ runItemId, value });
    }
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1 sm:flex-none"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              {!isReadOnly && (
                <Button
                  onClick={handleComplete}
                  disabled={completing}
                  className="flex-1 sm:flex-none"
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  {completing ? "Completing..." : "Complete Check"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

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
                          <CardContent className="p-4">
                            {/* Item Name */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2 flex-1 flex-wrap">
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
                                    className={`text-xs font-semibold ${
                                      item.actualQuantity > item.expectedQuantity
                                        ? "border-green-500 text-green-600 dark:text-green-500"
                                        : "border-red-500 text-red-600 dark:text-red-500"
                                    }`}
                                  >
                                    {item.actualQuantity > item.expectedQuantity ? "+" : ""}{item.actualQuantity - item.expectedQuantity}
                                  </Badge>
                                )}
                              </div>
                              {!isReadOnly && (
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
                                      variant="ghost"
                                      size="sm"
                                      className="text-muted-foreground hover:text-foreground shrink-0"
                                    >
                                      <MessageSquarePlus className="w-4 h-4" />
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
                                        autoFocus
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
                              )}
                            </div>

                            {/* Quantity Check or Yes/No Check */}
                            {item.expectedQuantity ? (
                              <div className="flex gap-2">
                                <Button
                                  variant={
                                    item.actualQuantity !== undefined && 
                                    (item.actualQuantity === item.expectedQuantity || item.actualQuantity !== 0)
                                      ? "default" 
                                      : "outline"
                                  }
                                  size="lg"
                                  onClick={() => handleSetValue(item._id, "yes", item.expectedQuantity)}
                                  disabled={isReadOnly}
                                  className={`flex-1 min-w-[100px] ${
                                    item.actualQuantity !== undefined && 
                                    (item.actualQuantity === item.expectedQuantity || item.actualQuantity !== 0)
                                      ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                                      : ""
                                  }`}
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </Button>
                                <Button
                                  variant={item.value === "no" && item.actualQuantity === 0 ? "destructive" : "outline"}
                                  size="lg"
                                  onClick={() => handleSetValue(item._id, "no", item.expectedQuantity)}
                                  disabled={isReadOnly}
                                  className="flex-1 min-w-[100px]"
                                >
                                  <XCircle className="w-5 h-5" />
                                </Button>
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
                                      size="lg"
                                      onClick={() => toggleQuantityInput(item._id)}
                                      disabled={isReadOnly}
                                      className={`min-w-[60px] ${
                                        item.actualQuantity !== undefined && 
                                        item.actualQuantity !== item.expectedQuantity && 
                                        item.actualQuantity !== 0
                                          ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
                                          : ""
                                      }`}
                                      title="Adjust quantity"
                                    >
                                      <span className="text-lg">±</span>
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
                                          autoFocus
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
                                                updateItem({ runItemId: item._id, actualQuantity: undefined, value: undefined });
                                              } else {
                                                const value = parseInt(inputValue, 10);
                                                if (!isNaN(value) && value >= 0 && Number.isInteger(value)) {
                                                  updateItem({ runItemId: item._id, actualQuantity: value, value: "yes" });
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
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  variant={item.value === "yes" ? "default" : "outline"}
                                  size="lg"
                                  onClick={() => handleSetValue(item._id, "yes")}
                                  disabled={isReadOnly}
                                  className={`flex-1 sm:flex-none min-w-[100px] ${item.value === "yes"
                                    ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                                    : ""
                                    }`}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                  Yes
                                </Button>
                                <Button
                                  variant={item.value === "no" ? "destructive" : "outline"}
                                  size="lg"
                                  onClick={() => handleSetValue(item._id, "no")}
                                  disabled={isReadOnly}
                                  className="flex-1 sm:flex-none min-w-[100px]"
                                >
                                  <XCircle className="w-4 h-4 mr-1.5" />
                                  No
                                </Button>
                              </div>
                            )}

                            {/* Show note content below buttons if exists */}
                            {hasNotes && (
                              <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
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
