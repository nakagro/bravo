import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface CancelEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle?: string;
  onConfirm: (reason: string | undefined) => void;
}

export function CancelEventDialog({
  open,
  onOpenChange,
  eventTitle,
  onConfirm,
}: CancelEventDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined);
    setReason("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Cancel Event</SheetTitle>
          <SheetDescription>
            {eventTitle
              ? `Cancel "${eventTitle}". It stays visible to members with a cancelled badge.`
              : "Cancel this event. It stays visible to members with a cancelled badge."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="cancellation-reason"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Reason for cancellation (optional)
            </label>
            <textarea
              id="cancellation-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason so members understand..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Keep Event
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Cancel Event
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
