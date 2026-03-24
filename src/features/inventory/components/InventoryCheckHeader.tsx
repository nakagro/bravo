import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardHeader } from "../../../components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../../components/ui/alert-dialog";
import { ArrowLeft, CheckCheck, Ban, FileDown, AlertTriangle } from "lucide-react";
import { ProgressRing } from "../../../components/common/ProgressRing";
import type { ProgressInfo, GroupedSection } from "../types/inventory.types";

interface InventoryCheckHeaderProps {
  templateName: string;
  status: "in_progress" | "completed" | "cancelled";
  progress: ProgressInfo;
  deviationCount: number;
  isReadOnly: boolean;
  completing: boolean;
  cancelling: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onExportPdf?: () => void;
  /** Sections for quick-nav */
  sections?: GroupedSection[];
  /** Callback to scroll to a section */
  onNavigateSection?: (sectionOrder: number) => void;
}

export function InventoryCheckHeader({
  templateName,
  status,
  progress,
  deviationCount,
  isReadOnly,
  completing,
  cancelling,
  onComplete,
  onCancel,
  onExportPdf,
  sections,
  onNavigateSection,
}: InventoryCheckHeaderProps) {
  const navigate = useNavigate();

  // Ring color: green when complete + no issues, amber if issues, red while in progress
  const ringColor = progress.percentage === 100
    ? (deviationCount > 0 ? "stroke-amber-500 dark:stroke-amber-400" : "stroke-green-500 dark:stroke-green-400")
    : "stroke-red-600 dark:stroke-red-500";

  return (
    <Card className="sticky top-0 z-10 shadow-md">
      <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
        <div className="flex flex-col gap-2">
          {/* Top row: Back + Title + Progress Ring */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-10 w-10 flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold truncate">{templateName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {status === "in_progress" ? (
                  <span className="text-xs text-muted-foreground">
                    {progress.answered}/{progress.total} checked
                  </span>
                ) : status === "completed" ? (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 text-xs">
                    Completed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">{status}</Badge>
                )}
                {deviationCount > 0 && (
                  <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 dark:text-amber-400 gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {deviationCount}
                  </Badge>
                )}
              </div>
            </div>

            {/* Progress ring */}
            {!isReadOnly && (
              <ProgressRing
                percentage={progress.percentage}
                size={48}
                strokeWidth={4}
                color={ringColor}
                labelClass="text-[11px] font-bold"
              />
            )}
          </div>

          {/* Section quick-nav pills */}
          {sections && sections.length > 1 && onNavigateSection && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {sections.map((section) => {
                const answered = section.items.filter(i => {
                  if (i.expectedQuantity !== undefined) return i.actualQuantity !== undefined;
                  return typeof i.value !== "undefined";
                }).length;
                const total = section.items.length;
                const complete = answered === total;
                const hasIssues = section.items.some(i => {
                  if (i.expectedQuantity !== undefined) return i.actualQuantity !== undefined && i.actualQuantity !== i.expectedQuantity;
                  return i.value === "no";
                });

                return (
                  <button
                    key={section.order}
                    onClick={() => onNavigateSection(section.order)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${complete
                      ? hasIssues
                        ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                        : "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                      }`}
                  >
                    {section.sectionName}
                    <span className="ml-1 opacity-60">{answered}/{total}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {isReadOnly && onExportPdf && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportPdf}
                className="flex-1 sm:flex-none h-10"
              >
                <FileDown className="w-4 h-4 mr-1.5" />
                Export PDF
              </Button>
            )}
            {!isReadOnly && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancelling}
                      className="flex-1 sm:flex-none h-10 text-destructive hover:text-destructive border-destructive/50 hover:border-destructive hover:bg-destructive/10"
                    >
                      <Ban className="w-4 h-4 mr-1.5" />
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
                        onClick={onCancel}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                      >
                        Yes, Cancel Check
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  size="sm"
                  onClick={onComplete}
                  disabled={completing}
                  className="flex-1 sm:flex-none h-10"
                >
                  <CheckCheck className="w-4 h-4 mr-1.5" />
                  {completing ? "Completing..." : "Complete Check"}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

export default InventoryCheckHeader;
