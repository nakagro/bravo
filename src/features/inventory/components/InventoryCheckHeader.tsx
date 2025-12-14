import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardHeader, CardTitle } from "../../../components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../../components/ui/alert-dialog";
import { ArrowLeft, CheckCheck, Ban } from "lucide-react";
import type { ProgressInfo } from "../types/inventory.types";

interface InventoryCheckHeaderProps {
  templateName: string;
  status: "in_progress" | "completed" | "cancelled";
  progress: ProgressInfo;
  isReadOnly: boolean;
  completing: boolean;
  cancelling: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

export function InventoryCheckHeader({
  templateName,
  status,
  progress,
  isReadOnly,
  completing,
  cancelling,
  onComplete,
  onCancel,
}: InventoryCheckHeaderProps) {
  const navigate = useNavigate();

  return (
    <Card className="sticky top-0 z-10 shadow-md">
      <CardHeader className="p-4 pb-3">
        <div className="flex flex-col gap-3">
          {/* Title and Badges Row */}
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg sm:text-xl">{templateName}</CardTitle>
            {status === "in_progress" ? (
              <Badge variant="secondary" className="bg-gray-600 hover:bg-gray-700 text-white dark:bg-gray-600">
                In Progress
              </Badge>
            ) : status === "completed" ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-600">
                Completed
              </Badge>
            ) : (
              <Badge variant="outline">
                {status}
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
                        onClick={onCancel}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                      >
                        Yes, Cancel Check
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  onClick={onComplete}
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
  );
}

export default InventoryCheckHeader;
