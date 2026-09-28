import { type ReactNode } from "react";
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
} from "@/components/ui/alert-dialog";

interface DeleteConfirmDialogProps {
  title: string;
  description: string;
  /** Omit when controlling the dialog via open/onOpenChange */
  trigger?: ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  /** Dismiss button label - override when the action itself is a "cancel" */
  cancelLabel?: string;
  destructive?: boolean;
  /** Controlled mode (e.g. opened from a dropdown menu item) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteConfirmDialog({
  title,
  description,
  trigger,
  onConfirm,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  open,
  onOpenChange,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={`w-full sm:w-auto ${
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
