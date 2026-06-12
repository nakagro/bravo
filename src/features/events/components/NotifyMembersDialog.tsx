import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface NotifyMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: Id<"events"> | null;
  eventTitle?: string;
}

export function NotifyMembersDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
}: NotifyMembersDialogProps) {
  const notifyMembers = useAction(api.eventActions.notifyEventMembers);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!eventId) return;
    try {
      setIsSending(true);
      await notifyMembers({ eventId, message: message.trim() || undefined });
      toast.success("Notification sent to all members");
      setMessage("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error notifying members:", error);
      toast.error("Failed to send notification", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Notify Members</SheetTitle>
          <SheetDescription>
            {eventTitle
              ? `Send a push notification about "${eventTitle}" to all members.`
              : "Send a push notification about this event to all members."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="notify-message"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Message (optional)
            </label>
            <textarea
              id="notify-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Leave blank to send the event date, time and location..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isSending ? "Sending..." : "Send to Everyone"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
