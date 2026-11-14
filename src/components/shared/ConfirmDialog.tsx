import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  title: ReactNode;
  description?: ReactNode;
  /** Extra content under the description, e.g. a list of what will change. */
  children?: ReactNode;
  /** The element that opens the dialog. Omit when controlling it with open/onOpenChange. */
  trigger?: ReactNode;
  /**
   * Runs when the member confirms. Return a promise to keep the dialog open
   * with a spinner on the confirm button until it settles. It closes when the
   * promise resolves and stays open if it rejects, so a handler that wants
   * the prompt kept up after a failure reports the error and rethrows.
   */
  onConfirm: () => unknown;
  confirmLabel?: ReactNode;
  cancelLabel?: string;
  /** "destructive" paints the confirm button red: deletes, cancellations, revokes. */
  tone?: "default" | "destructive";
  /** Disable the confirm button, e.g. until a required choice is made. */
  confirmDisabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * The one yes/no prompt. Use it for every confirmation instead of composing
 * AlertDialog by hand, so button order, sizing and colour match everywhere.
 * Anything the member types into belongs in ResponsiveModal instead.
 */
export function ConfirmDialog({
  title,
  description,
  children,
  trigger,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  confirmDisabled = false,
  open,
  onOpenChange,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const isOpen = open ?? internalOpen;

  const applyOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  // Member-initiated changes (Cancel, Escape, trigger). No dismissing mid-action.
  const setOpen = (next: boolean) => {
    if (pending && !next) return;
    applyOpen(next);
  };

  const handleConfirm = async () => {
    const result = onConfirm();
    if (!(result instanceof Promise)) {
      applyOpen(false);
      return;
    }
    setPending(true);
    try {
      await result;
      setPending(false);
      applyOpen(false);
    } catch {
      // The caller reports the error; leave the dialog up so they can retry.
      setPending(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">{title}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <AlertDialogCancel disabled={pending} className="mt-0 h-11 w-full sm:h-9 sm:w-auto">
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            variant={tone === "destructive" ? "destructive" : "default"}
            loading={pending}
            disabled={confirmDisabled}
            onClick={handleConfirm}
            className="h-11 w-full sm:h-9 sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
