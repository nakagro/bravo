import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { ChangeNoticePreview, useChangePreview } from "./EventChangeNotice";
import { errorMessage } from "@/lib/errors";

// Matches NOTE_MAX on the server: the reason is the notice's {message}.
const REASON_MAX = 140;

interface CancelEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: Id<"events"> | null;
  eventTitle?: string;
  /** After a successful cancel. `notified` = a notice went out, so no Undo. */
  onCancelled?: (eventId: Id<"events">, notified: boolean) => void;
}

/**
 * Cancels the event and, unless the box is unticked, tells everyone involved
 * in the same transaction. Ticked by default: a cancellation people don't
 * hear about is the costly mistake.
 */
export function CancelEventDialog({ open, onOpenChange, eventId, eventTitle, onCancelled }: CancelEventDialogProps) {
  if (!eventId) return null;
  return (
    <CancelEventSheet
      key={eventId}
      open={open}
      onOpenChange={onOpenChange}
      eventId={eventId}
      eventTitle={eventTitle}
      onCancelled={onCancelled}
    />
  );
}

function CancelEventSheet({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  onCancelled,
}: CancelEventDialogProps & { eventId: Id<"events"> }) {
  const [reason, setReason] = useState("");
  const [tell, setTell] = useState(true);
  const [busy, setBusy] = useState(false);
  const cancelEvent = useMutation(api.events.cancelEvent);
  const { preview, current } = useChangePreview(eventId, "cancelled", reason, open);
  const n = preview?.recipients.length ?? 0;
  const notify = tell && n > 0;

  const close = () => {
    setReason("");
    setTell(true);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await cancelEvent({
        eventId,
        reason: reason.trim() || undefined,
        notifyFingerprint: notify ? preview?.fingerprint : undefined,
      });
      close();
      onCancelled?.(eventId, notify);
    } catch (error) {
      console.error("Error cancelling event:", error);
      toast.error("Failed to cancel event", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onClose={close}
      title="Cancel Event"
      drawerHeight="max-h-[90vh]"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Keep Event
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy || preview === undefined || (notify && !current)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {notify ? `Cancel event and tell ${n}` : "Cancel Event"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-4">
        <p className="text-sm text-muted-foreground">
          {eventTitle
            ? `Cancel "${eventTitle}". It stays visible to members with a cancelled badge.`
            : "Cancel this event. It stays visible to members with a cancelled badge."}
        </p>
        <div>
          <label
            htmlFor="cancellation-reason"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Reason (optional)
          </label>
          <textarea
            id="cancellation-reason"
            value={reason}
            maxLength={REASON_MAX}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Provide a reason so members understand..."
            rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        {n > 0 && preview && (
          <>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
              <input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} />
              Tell the {n} {n === 1 ? "member" : "members"} involved
            </label>
            {tell && <ChangeNoticePreview preview={preview} />}
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}
