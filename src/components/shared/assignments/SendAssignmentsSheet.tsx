import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { NotificationCard } from "./NotificationCard";
import { NotificationLog } from "./NotificationLog";
import { errorMessage } from "@/lib/errors";

export type AssignmentSourceKey = "event" | "deploymentDay";
type Audience = "changes" | "everyone";
type State = "new" | "changed" | "unchanged" | "removed";

// Matches NOTE_MAX in convex/lib/notificationTemplates.ts
const NOTE_MAX = 140;

const STATE_LABEL: Record<State, string> = {
  new: "New",
  changed: "Changed",
  removed: "Removed",
  unchanged: "Up to date",
};
const STATE_CLASS: Record<State, string> = {
  new: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  changed: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  removed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  unchanged: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
};
const PUSH_NOTE = {
  on: null,
  muted: "Push off, Action Centre only",
  noDevice: "No device, Action Centre only",
} as const;

/**
 * The two-step send for assignment notices: who's getting what, then the
 * exact text they'll get. Generic over the source; the server renders every
 * message and refuses the send if anything changed since this was shown.
 */
export function SendAssignmentsSheet({
  open,
  onOpenChange,
  source,
  scopeId,
  heading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: AssignmentSourceKey;
  scopeId: string;
  heading: string;
}) {
  const [step, setStep] = useState<"who" | "confirm">("who");
  const [audience, setAudience] = useState<Audience>("changes");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState<State | null>(null);
  const debouncedMessage = useDebouncedValue(message.trim());

  const args = { source, scopeId, audience, message: debouncedMessage || undefined };
  const live = useQuery(api.assignmentNotices.previewAssignmentNotice, open ? args : "skip");
  // Keep the last result on screen while the next one loads, so the card
  // doesn't blank on every keystroke.
  const [shown, setShown] = useState<typeof live>(undefined);
  if (live !== undefined && live !== shown) setShown(live);
  const preview = live ?? shown;
  const upToDate = live !== undefined && debouncedMessage === message.trim();

  const send = useMutation(api.assignmentNotices.sendAssignmentNotice);

  const close = () => {
    onOpenChange(false);
    setStep("who");
    setMessage("");
    setAudience("changes");
    setExpanded(null);
  };

  const handleSend = async () => {
    if (!preview) return;
    setSending(true);
    try {
      const n = await send({ ...args, fingerprint: preview.fingerprint });
      toast.success(`Sent to ${n} ${n === 1 ? "member" : "members"}`);
      close();
    } catch (error) {
      toast.error("Not sent", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    } finally {
      setSending(false);
    }
  };

  const recipients = preview?.recipients ?? [];
  const groups = (["new", "changed", "removed", "unchanged"] as State[])
    .map((state) => ({ state, members: recipients.filter((r) => r.state === state) }))
    .filter((g) => g.members.length > 0);
  const first = recipients[0];

  return (
    <ResponsiveModal
      open={open}
      onClose={close}
      title={step === "who" ? "Send to crew" : "Check what they'll see"}
      drawerHeight="max-h-[90vh]"
      footer={
        step === "who" ? (
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep("confirm")}
              disabled={recipients.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Next
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStep("who")}>
              Back
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !upToDate || recipients.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {sending
                ? "Sending..."
                : `Send to ${recipients.length} ${recipients.length === 1 ? "member" : "members"}`}
            </Button>
          </>
        )
      }
    >
      <div className="pb-4">
        <p className="text-sm text-muted-foreground">{heading}</p>

        {preview === null && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">This can't be sent any more.</p>
        )}

        {preview && step === "who" && (
          <div className="mt-4 space-y-4">
            <ul className="space-y-2">
              {recipients.map((r) => (
                <li key={r.userId} className="flex items-start gap-2 text-sm">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATE_CLASS[r.state]}`}>
                    {STATE_LABEL[r.state]}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white">{r.name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {r.state === "removed"
                        ? `was ${r.previousLines.join(", ")}`
                        : r.state === "changed"
                          ? `${r.previousLines.join(", ")} → ${r.lines.join(", ")}`
                          : r.lines.join(", ")}
                    </div>
                    {PUSH_NOTE[r.push] && (
                      <div className="text-xs text-amber-700 dark:text-amber-400">{PUSH_NOTE[r.push]}</div>
                    )}
                  </div>
                </li>
              ))}
              {audience === "changes" && preview.unchangedCount > 0 && (
                <li className="text-sm text-gray-600 dark:text-gray-400">
                  ✓ {preview.unchangedCount} up to date (already told, unchanged)
                </li>
              )}
              {recipients.length === 0 && (
                <li className="text-sm text-gray-600 dark:text-gray-400">Everyone has already been told.</li>
              )}
            </ul>

            {preview.notNotified.length > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-200">
                <div className="font-medium">Not notified, contact them yourself:</div>
                <ul className="mt-1 text-xs">
                  {preview.notNotified.map((n, i) => (
                    <li key={i}>
                      {n.name} ({n.reason})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <fieldset className="space-y-1 text-sm">
              {(
                [
                  ["changes", "Only new, changed & removed"],
                  ["everyone", "Everyone on the crew"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="assignment-audience"
                    checked={audience === value}
                    onChange={() => setAudience(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <NoteField value={message} onChange={setMessage} />

            <NotificationLog source={source} scopeId={scopeId} limit={3} title="Already sent" bare />

          </div>
        )}

        {preview && step === "confirm" && (
          <div className="mt-4 space-y-4">
            {first && <NotificationCard title={first.title} body={first.body} />}
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.state}>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === g.state ? null : g.state)}
                    className="flex items-center gap-1 text-sm font-medium text-gray-800 dark:text-gray-200"
                  >
                    {expanded === g.state ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {STATE_LABEL[g.state]} ({g.members.length})
                  </button>
                  {expanded === g.state && (
                    <div className="mt-2 space-y-2 pl-5">
                      {g.members.map((r) => (
                        <div key={r.userId}>
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{r.name}</div>
                          <NotificationCard title={r.title} body={r.body} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Also appears in each member's Action Centre.</p>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}

export function NoteField({
  value,
  onChange,
  label = "Add a note (optional)",
  hint = "Leave blank to send the standard message shown below.",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <textarea
        value={value}
        maxLength={NOTE_MAX}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
      />
      <div className="mt-0.5 flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{hint}</span>
        <span>
          {value.length}/{NOTE_MAX}
        </span>
      </div>
    </div>
  );
}

/** "Send to crew", with a count when the crew differs from what was last sent. Hidden when there's nothing to send. */
export function SendAssignmentsButton({
  source,
  scopeId,
  heading,
  className,
}: {
  source: AssignmentSourceKey;
  scopeId: string | Id<"events">;
  heading: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const preview = useQuery(api.assignmentNotices.previewAssignmentNotice, {
    source,
    scopeId,
    audience: "changes",
  });
  if (!preview) return null;
  if (preview.pendingCount === 0 && preview.unchangedCount === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        }
      >
        Send to crew
        {preview.pendingCount > 0 && (
          <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
            {preview.pendingCount}
          </span>
        )}
      </button>
      <SendAssignmentsSheet open={open} onOpenChange={setOpen} source={source} scopeId={scopeId} heading={heading} />
    </>
  );
}
