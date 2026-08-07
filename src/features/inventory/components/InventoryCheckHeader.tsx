import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardHeader } from "../../../components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog";
import { ArrowLeft, Ban, FileDown } from "lucide-react";

interface InventoryCheckHeaderProps {
  templateName: string;
  status: "in_progress" | "completed" | "cancelled";
  isReadOnly: boolean;
  cancelling: boolean;
  onCancel: () => void;
  onExportPdf?: () => void;
}

/**
 * Run identity and the run-level actions. Progress, counts, deviations and the
 * section pills live in the shared `ChecklistProgressHeader`; Complete lives in
 * the shared `ChecklistActionBar` at the bottom, where the thumb is.
 */
export function InventoryCheckHeader({
  templateName,
  status,
  isReadOnly,
  cancelling,
  onCancel,
  onExportPdf,
}: InventoryCheckHeaderProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-11 w-11 flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Button>

            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold truncate">
                {templateName}
              </h1>
              {status === "completed" ? (
                <Badge
                  variant="default"
                  className="mt-0.5 bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 text-xs"
                >
                  Completed
                </Badge>
              ) : status === "cancelled" ? (
                <Badge variant="outline" className="mt-0.5 text-xs">
                  Cancelled
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {isReadOnly && onExportPdf && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportPdf}
                className="flex-1 sm:flex-none h-11"
              >
                <FileDown className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Export PDF
              </Button>
            )}
            {!isReadOnly && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancelling}
                    className="flex-1 sm:flex-none h-11 text-destructive hover:text-destructive border-destructive/50 hover:border-destructive hover:bg-destructive/10"
                  >
                    <Ban className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    {cancelling ? "Cancelling..." : "Cancel"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Inventory Check?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to cancel this inventory check? All
                      progress will be lost and this action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                    <AlertDialogCancel className="w-full sm:w-auto">
                      Keep Checking
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onCancel}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                    >
                      Yes, Cancel Check
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
