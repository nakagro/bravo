import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, FileText, Hash } from "lucide-react";
import type { RunItemDoc, DeviationItem } from "../types/inventory.types";

interface InventoryExecutiveSummaryProps {
  items: RunItemDoc[];
}

export function InventoryExecutiveSummary({ items }: InventoryExecutiveSummaryProps) {
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
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">
            {deviations.length} Deviation{deviations.length !== 1 ? "s" : ""} Found
          </h3>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-2">
          {deviations.map((deviation) => (
            <div
              key={deviation.item._id}
              className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/50"
            >
              <div className="flex items-start gap-3">
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
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="font-medium text-sm text-gray-900 dark:text-white break-words">
                    {deviation.item.itemName}
                  </span>

                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Location:</span> {deviation.item.sectionName}
                  </div>

                  {deviation.deviationType === "no" && (
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Marked as <span className="font-semibold">No</span>
                    </div>
                  )}

                  {deviation.deviationType === "quantity_mismatch" && (
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {(() => {
                        const expected = deviation.item.expectedQuantity ?? 0;
                        const found = deviation.item.actualQuantity ?? 0;
                        const diff = found - expected;
                        const isOver = diff > 0;

                        return (
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Found:</span>
                              <span className={`inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 text-sm font-bold rounded-md ${isOver
                                  ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                                  : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                                }`}>
                                {found}
                              </span>
                            </div>
                            <span className="text-muted-foreground">→</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Expected:</span>
                              <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 text-sm font-bold rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {expected}
                              </span>
                            </div>
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-semibold rounded ${isOver
                                ? "bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200"
                                : "bg-red-200 dark:bg-red-800/60 text-red-800 dark:text-red-200"
                              }`}>
                              {isOver ? `+${diff} over` : `${diff} short`}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {deviation.deviationType === "notes_only" && (
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Notes were left for this item.
                    </div>
                  )}

                  {deviation.item.notes && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                      <span className="font-medium">Notes:</span> {deviation.item.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default InventoryExecutiveSummary;
