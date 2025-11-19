import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "../../../components/ui/button";
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
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const toggleNotes = (itemId: string) => {
    setExpandedNotes(prev => {
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
    const answered = items.filter(i => typeof i.value !== "undefined").length;
    const total = items.length;
    return { answered, total, percentage: total > 0 ? Math.round((answered / total) * 100) : 0 };
  }, [runData]);

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
          const sectionAnswered = section.items.filter(i => typeof i.value !== "undefined").length;
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
                      const showNotes = expandedNotes.has(item._id) || hasNotes;

                      return (
                        <Card key={item._id}>
                          <CardContent className="p-4">
                            {/* Item Name and Buttons */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="flex items-center justify-between flex-1 gap-2">
                                <div className="flex items-center gap-2 flex-1">
                                  <div className="font-medium text-sm sm:text-base pt-1">
                                    {item.itemName}
                                  </div>
                                  <ItemInfoButton item={item} />
                                </div>
                                {!showNotes && !isReadOnly && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleNotes(item._id)}
                                    className="text-muted-foreground hover:text-foreground shrink-0"
                                  >
                                    <MessageSquarePlus className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                              <div className="flex gap-2 sm:flex-shrink-0">
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
                            </div>

                            {/* Notes Field - Always available for all items */}
                            {showNotes && (
                              <div className="mt-3 space-y-2">
                                <Textarea
                                  defaultValue={item.notes ?? ""}
                                  placeholder="Add notes (optional)..."
                                  onBlur={(e) => handleSaveNotes(item._id, e.target.value)}
                                  disabled={isReadOnly}
                                  className="min-h-[80px] text-sm"
                                />
                                {!isReadOnly && !hasNotes && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleNotes(item._id)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    Cancel
                                  </Button>
                                )}
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
