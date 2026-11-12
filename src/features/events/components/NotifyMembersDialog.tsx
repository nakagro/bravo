import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NoteField } from "@/components/shared/assignments/SendAssignmentsSheet";
import { ChangeNoticePreview, useChangePreview, type MessageAudience } from "./EventChangeNotice";

interface NotifyMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: Id<"events"> | null;
  eventTitle?: string;
}

/**
 * The one place to message people about an event: the people involved
 * (rostered, crewed, yes, maybe, offered a shift) or every member. Shows the
 * exact notification before it goes, like every other targeted send. Crew
 * and roster notices stay on "Send to crew", which says what each member holds.
 */
export function NotifyMembersDialog({ open, onOpenChange, eventId, eventTitle }: NotifyMembersDialogProps) {
  if (!eventId) return null;
  return (
    <MessageSheet key={eventId} open={open} onOpenChange={onOpenChange} eventId={eventId} eventTitle={eventTitle} />
  );
}

function MessageSheet({ open, onOpenChange, eventId, eventTitle }: NotifyMembersDialogProps & { eventId: Id<"events"> }) {
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<MessageAudience>("involved");
  const [sending, setSending] = useState(false);
  const { preview, current } = useChangePreview(eventId, "message", message, open, audience);
  // Counts for both choices, so the radio labels can say how many
  const involved = useChangePreview(eventId, "message", "", open, "involved").preview;
  const everyone = useChangePreview(eventId, "message", "", open, "everyone").preview;
  const send = useMutation(api.eventChangeNotices.sendEventChangeNotice);
  const n = preview?.recipients.length ?? 0;
  const hasText = message.trim().length > 0;

  const close = () => {
    setMessage("");
    setAudience("involved");
    onOpenChange(false);
  };

  const handleSend = async () => {
    if (!preview) return;
    setSending(true);
    try {
      const sent = await send({
        eventId,
        kind: "message",
        audience,
        message: message.trim(),
        fingerprint: preview.fingerprint,
      });
      toast.success(`Sent to ${sent} ${sent === 1 ? "member" : "members"}`);
      close();
    } catch (error) {
      toast.error("Not sent", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setSending(false);
    }
  };

  const options: [MessageAudience, string, number | undefined][] = [
    ["involved", "People involved (going, maybe, rostered, crewed)", involved?.recipients.length],
    ["everyone", "All members", everyone?.recipients.length],
  ];

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Message members</SheetTitle>
          <SheetDescription>
            {eventTitle ? `Send a notification about "${eventTitle}".` : "Send a notification about this event."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {preview === null && (
            <p className="text-sm text-gray-600 dark:text-gray-400">Messages can't be sent for this event any more.</p>
          )}
          <fieldset className="space-y-1 text-sm">
            {options.map(([value, label, count]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="message-audience"
                  checked={audience === value}
                  onChange={() => setAudience(value)}
                />
                {label}
                {count !== undefined && <span className="text-gray-500">({count})</span>}
              </label>
            ))}
          </fieldset>
          <NoteField
            value={message}
            onChange={setMessage}
            label="Message"
            hint="The event's date, time and place are added underneath."
          />
          {preview && hasText && <ChangeNoticePreview preview={preview} />}
          <div className="flex gap-3">
            <Button variant="outline" onClick={close} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !preview || !current || !hasText || n === 0}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {sending ? "Sending..." : `Send to ${n}`}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
