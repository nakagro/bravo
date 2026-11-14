import { useState } from "react";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";

interface RejectBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceName?: string;
  onConfirm: (reviewNotes: string | undefined) => void;
}

export function RejectBookingDialog({
  open,
  onOpenChange,
  resourceName,
  onConfirm,
}: RejectBookingDialogProps) {
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onConfirm(notes.trim() || undefined);
    setNotes("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setNotes("");
    onOpenChange(false);
  };

  return (
    <ResponsiveModal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Reject Booking"
      drawerHeight="max-h-[85vh]"
      footer={
        <>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="bg-red-600 hover:bg-red-700 text-white">
            Reject Booking
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-4">
        <p className="text-sm text-muted-foreground">
          {resourceName
            ? `Reject the booking request for "${resourceName}".`
            : "Reject this booking request."}
        </p>
        <div>
          <label
            htmlFor="rejection-notes"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Reason for rejection (optional)
          </label>
          <textarea
            id="rejection-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Provide a reason so the requester understands..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </div>
    </ResponsiveModal>
  );
}
