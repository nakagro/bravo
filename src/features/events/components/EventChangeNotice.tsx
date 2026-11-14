import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { NotificationCard } from "@/components/shared/assignments/NotificationCard";
import { NoteField } from "@/components/shared/assignments/SendAssignmentsSheet";
import { errorMessage } from "@/lib/errors";

export type ChangeKind = "cancelled" | "detailsChanged" | "restored" | "message";
export type MessageAudience = "involved" | "everyone";

const REASON_LABEL = {
  rostered: "rostered or crewed",
  going: "going",
  maybe: "maybe",
  offered: "offered for a shift",
  told: "told it was cancelled",
  member: "members",
} as const;

/**
 * The live preview of an event change notice. Keeps the last result on screen
 * while a new note is debounced, and reports whether what's shown is current.
 */
export function useChangePreview(
  eventId: Id<"events">,
  kind: ChangeKind,
  message: string,
  enabled: boolean,
  audience?: MessageAudience
) {
  const debounced = useDebouncedValue(message.trim());
  const live = useQuery(
    api.eventChangeNotices.previewEventChangeNotice,
    enabled ? { eventId, kind, message: debounced || undefined, audience } : "skip"
  );
  const [shown, setShown] = useState<typeof live>(undefined);
  if (live !== undefined && live !== shown) setShown(live);
  const preview = live ?? shown;
  return { preview, current: live !== undefined && debounced === message.trim() };
}

type Preview = NonNullable<ReturnType<typeof useChangePreview>["preview"]>;

/** The card all recipients get, and who they are. */
export function ChangeNoticePreview({ preview }: { preview: Preview }) {
  const [open, setOpen] = useState(false);
  const parts = (Object.keys(REASON_LABEL) as (keyof typeof REASON_LABEL)[])
    .filter((key) => preview.counts[key] > 0)
    .map((key) => `${preview.counts[key]} ${REASON_LABEL[key]}`);
  return (
    <div className="space-y-2">
      <NotificationCard title={preview.title} body={preview.body} />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-start gap-1 text-left text-xs text-gray-600 dark:text-gray-400"
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        Who: {parts.join(" · ") || "nobody"}
      </button>
      {open && (
        <p className="pl-5 text-xs text-gray-700 dark:text-gray-300">
          {preview.recipients.map((r) => r.name).join(", ")}
        </p>
      )}
      {preview.cantNotify > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {preview.cantNotify} can't be notified (disabled, or no access to Events).
        </p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">Also appears in their Action Centre.</p>
    </div>
  );
}

const SHEET_COPY = {
  detailsChanged: { title: "Tell members about the change?", send: "Send to" },
  cancelled: { title: "Tell members it's cancelled", send: "Send to" },
} as const;

/** "Changed: …" after an edit, or announcing a cancellation after the fact. */
export function EventChangeNoticeSheet({
  open,
  onOpenChange,
  eventId,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: Id<"events">;
  kind: "detailsChanged" | "cancelled";
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { preview, current } = useChangePreview(eventId, kind, message, open);
  const send = useMutation(api.eventChangeNotices.sendEventChangeNotice);
  const n = preview?.recipients.length ?? 0;

  const close = () => {
    onOpenChange(false);
    setMessage("");
  };

  // Nobody involved (or it no longer applies): nothing to offer, so don't ask.
  const nothingToSend = open && (preview === null || (preview !== undefined && n === 0));
  useEffect(() => {
    if (nothingToSend) onOpenChange(false);
  }, [nothingToSend, onOpenChange]);

  const handleSend = async () => {
    if (!preview) return;
    setSending(true);
    try {
      const sent = await send({ eventId, kind, message: message.trim() || undefined, fingerprint: preview.fingerprint });
      toast.success(`Sent to ${sent} ${sent === 1 ? "member" : "members"}`);
      close();
    } catch (error) {
      toast.error("Not sent", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{SHEET_COPY[kind].title}</SheetTitle>
          <SheetDescription>
            {kind === "detailsChanged"
              ? `The date, time or place changed. Tell the ${n} ${n === 1 ? "member" : "members"} involved?`
              : `Nobody has been told yet. Tell the ${n} ${n === 1 ? "member" : "members"} involved?`}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {preview === null && <p className="text-sm text-gray-600 dark:text-gray-400">This can't be sent any more.</p>}
          {preview && <ChangeNoticePreview preview={preview} />}
          <NoteField value={message} onChange={setMessage} />
          <div className="flex gap-3">
            <Button variant="outline" onClick={close} className="flex-1">
              Not now
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !preview || !current || n === 0}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {sending ? "Sending..." : `${SHEET_COPY[kind].send} ${n}`}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Restore a cancelled event. When its cancellation was announced, offers the
 * "Back on" notice to the same members; otherwise it's a plain restore.
 */
export function RestoreEventDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: Id<"events">;
  eventTitle?: string;
}) {
  const [busy, setBusy] = useState(false);
  const { preview } = useChangePreview(eventId, "restored", "", open);
  const restoreEvent = useMutation(api.events.restoreEvent);
  const n = preview?.recipients.length ?? 0;

  const restore = async (notify: boolean) => {
    setBusy(true);
    try {
      await restoreEvent({ eventId, notifyFingerprint: notify ? preview?.fingerprint : undefined });
      toast.success(notify ? `Event restored, ${n} ${n === 1 ? "member" : "members"} told` : "Event restored");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to restore event", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Restore event</SheetTitle>
          <SheetDescription>
            {n > 0
              ? `Members were told "${eventTitle ?? "this event"}" was cancelled. Tell the ${n} it's back on?`
              : `Put "${eventTitle ?? "this event"}" back on.`}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {preview && n > 0 && <ChangeNoticePreview preview={preview} />}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => restore(false)} disabled={busy || preview === undefined} className="flex-1">
              {n > 0 ? "Restore only" : "Restore"}
            </Button>
            {n > 0 && (
              <Button onClick={() => restore(true)} disabled={busy} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                Restore and tell {n}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
