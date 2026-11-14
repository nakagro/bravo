import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

interface DeleteEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle?: string;
  onConfirm: () => void;
}

/**
 * Destructive confirm for permanently deleting a cancelled event. Unlike cancel
 * (which keeps the event with an undo), this can't be undone, so it gets an
 * explicit alert dialog.
 */
export function DeleteEventDialog({
  open,
  onOpenChange,
  eventTitle,
  onConfirm,
}: DeleteEventDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this event?"
      description={<>{eventTitle ? `"${eventTitle}" ` : "This event "} and all of its RSVPs, shifts and history will be permanently deleted. This can&apos;t be undone.</>}
      confirmLabel="Delete permanently"
      cancelLabel="Keep event"
      tone="destructive"
      onConfirm={onConfirm}
    />
  );
}
