import { useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { AssignmentSourceKey } from "./SendAssignmentsSheet";

const KIND_LABEL: Record<string, string> = {
  assignment: "Crew / roster notice",
  cancelled: "Cancellation",
  detailsChanged: "Change of details",
  restored: "Back on",
  message: "Message",
  broadcast: "Notify all members",
};

const STATE_WORD: Record<string, string> = {
  new: "new",
  changed: "changed",
  removed: "removed",
  unchanged: "reminder",
};

function when(ms: number) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

/**
 * The running sheet of what has already been sent for an event or deployment
 * day: one line per send, tap for who got it. Renders nothing for members who
 * can't send, or before anything has gone out.
 */
export function NotificationLog({
  source,
  scopeId,
  limit,
  title = "Notifications sent",
  bare = false,
}: {
  source: AssignmentSourceKey;
  scopeId: string;
  limit?: number;
  title?: string;
  /** Without the card chrome, for use inside a sheet. */
  bare?: boolean;
}) {
  const sends = useQuery(api.assignmentNotices.listNotificationSends, { source, scopeId });
  const [open, setOpen] = useState<string | null>(null);
  if (!sends || sends.length === 0) return null;
  const shown = limit ? sends.slice(0, limit) : sends;

  const list = (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {shown.map((s) => {
        const counts = new Map<string, number>();
        for (const r of s.recipients) if (r.state) counts.set(r.state, (counts.get(r.state) ?? 0) + 1);
        const split = [...counts].map(([state, n]) => `${n} ${STATE_WORD[state] ?? state}`).join(", ");
        const who =
          s.kind === "broadcast"
            ? "everyone with notifications on"
            : `${s.recipientCount} ${s.recipientCount === 1 ? "member" : "members"}${split ? ` (${split})` : ""}`;
        const expandable = s.recipients.length > 0 || !!s.message;
        const isOpen = open === s._id;
        return (
          <li key={s._id} className="py-2">
            <button
              type="button"
              disabled={!expandable}
              onClick={() => setOpen(isOpen ? null : s._id)}
              className="flex w-full items-start gap-1.5 text-left"
            >
              {expandable ? (
                isOpen ? (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                ) : (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                )
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <span className="min-w-0 text-sm">
                <span className="font-medium text-gray-900 dark:text-white">{KIND_LABEL[s.kind] ?? s.kind}</span>
                <span className="text-gray-600 dark:text-gray-400"> · {who}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {when(s.sentAt)} by {s.sentByName}
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="mt-1.5 space-y-1 pl-6 text-xs text-gray-700 dark:text-gray-300">
                <div className="text-gray-500">“{s.title}”</div>
                {s.message && <div>Note: {s.message}</div>}
                {s.recipients.length > 0 && (
                  <div>
                    {s.recipients
                      .map((r) => (r.state && r.state !== "new" ? `${r.name} (${STATE_WORD[r.state] ?? r.state})` : r.name))
                      .join(", ")}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (bare) {
    return (
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
        {list}
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-1">
        {title} ({sends.length})
      </h3>
      {list}
    </div>
  );
}
