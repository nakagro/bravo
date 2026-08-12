import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ArrowsUpDownIcon } from "@heroicons/react/24/outline";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatDateTime, getRelativeTimeString } from "@/utils/dateUtils";

const DAY = 24 * 60 * 60 * 1000;

interface MemberActivityProps {
  showTitle?: boolean;
}

/**
 * Who has actually been using BRAVO, and who has quietly stopped.
 *
 * "Last seen" is derived from the auth tables rather than a tracked event, so it
 * reads as "had the app open around then" - see `authManagement.getMemberActivity`
 * for what that does and doesn't prove.
 */
export function MemberActivity({ showTitle = true }: MemberActivityProps) {
  const activity = useQuery(api.authManagement.getMemberActivity);
  const [oldestFirst, setOldestFirst] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [openUser, setOpenUser] = useState<{ id: Id<"users">; name: string } | null>(null);

  const rows = useMemo(() => {
    if (!activity) return [];
    const visible = includeInactive
      ? activity
      : activity.filter((row) => !row.isShared && !row.isDisabled);

    return [...visible].sort((a, b) => {
      // Never-seen accounts are the point of the list, so they sort to whichever
      // end "oldest" is, rather than falling out of the ordering entirely.
      const aSeen = a.lastSeenAt ?? 0;
      const bSeen = b.lastSeenAt ?? 0;
      return oldestFirst ? aSeen - bSeen : bSeen - aSeen;
    });
  }, [activity, oldestFirst, includeInactive]);

  const summary = useMemo(() => {
    const people = (activity ?? []).filter((row) => !row.isShared && !row.isDisabled);
    const now = Date.now();
    return {
      total: people.length,
      week: people.filter((r) => r.lastSeenAt && now - r.lastSeenAt < 7 * DAY).length,
      month: people.filter((r) => r.lastSeenAt && now - r.lastSeenAt < 30 * DAY).length,
      never: people.filter((r) => !r.lastSeenAt).length,
    };
  }, [activity]);

  if (activity === undefined) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
      {showTitle && (
        <h2 className="text-xl font-semibold dark:text-white">Member Activity</h2>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Members", value: summary.total },
          { label: "Past 7 days", value: summary.week },
          { label: "Past 30 days", value: summary.month },
          { label: "No live session", value: summary.never },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-md border border-gray-200 dark:border-gray-700 p-3"
          >
            <p className="text-2xl font-semibold dark:text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOldestFirst((v) => !v)}
          className="flex items-center gap-2"
        >
          <ArrowsUpDownIcon className="h-4 w-4" />
          {oldestFirst ? "Least recent first" : "Most recent first"}
        </Button>
        <div className="flex items-center gap-2">
          <Switch
            id="include-inactive"
            checked={includeInactive}
            onCheckedChange={setIncludeInactive}
            className="dark:data-[state=unchecked]:bg-gray-600"
          />
          <Label htmlFor="include-inactive" className="text-sm dark:text-gray-200">
            Include shared &amp; disabled
          </Label>
        </div>
      </div>

      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {rows.length === 0 && (
          <li className="py-4 text-sm text-gray-500 dark:text-gray-400">
            No accounts to show.
          </li>
        )}
        {rows.map((row) => (
          <li key={row.userId}>
            <button
              type="button"
              onClick={() => setOpenUser({ id: row.userId, name: row.name })}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md py-3 px-2 text-left transition-colors hover:bg-accent/50"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium dark:text-gray-100">{row.name}</span>
                  {row.rank && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{row.rank}</span>
                  )}
                  {row.isShared && <Badge variant="outline">Shared</Badge>}
                  {row.isDisabled && <Badge variant="destructive">Disabled</Badge>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {row.lastSeenAt
                    ? `Signed in on ${row.deviceCount} ${row.deviceCount === 1 ? "device" : "devices"}`
                    : "No live session"}
                  {row.lastStatusChangeAt
                    ? ` · availability set ${getRelativeTimeString(row.lastStatusChangeAt)}`
                    : " · never set availability"}
                </p>
              </div>
              <div className="text-right">
                {row.lastSeenAt ? (
                  <>
                    <p className="text-sm font-medium dark:text-gray-100">
                      {getRelativeTimeString(row.lastSeenAt)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(row.lastSeenAt)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Not signed in</p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <MemberSessionsModal
        userId={openUser?.id ?? null}
        name={openUser?.name ?? ""}
        onClose={() => setOpenUser(null)}
      />

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Last seen is derived from sign-in sessions and the token refreshes the app
        makes while it's open, so it's accurate to roughly the hour and means "the
        app was running", not "they tapped something". Signing out or being
        disabled clears the session, which shows here as no live session.
      </p>
    </div>
  );
}

/**
 * The sessions behind one member's last-seen time. Drawer on mobile, sheet on
 * desktop, like every other detail panel in the app.
 */
function MemberSessionsModal({
  userId,
  name,
  onClose,
}: {
  userId: Id<"users"> | null;
  name: string;
  onClose: () => void;
}) {
  // `"skip"` keeps these from firing until a row is actually opened.
  const sessions = useQuery(
    api.authManagement.getUserSessionHistory,
    userId ? { userId } : "skip",
  );
  const statusHistory = useQuery(
    api.authManagement.getUserStatusHistory,
    userId ? { userId } : "skip",
  );

  return (
    <ResponsiveModal open={userId !== null} onClose={onClose} title={name}>
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Recent availability changes
          </h3>
          {statusHistory === undefined ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : statusHistory.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This member has never set an availability status.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {statusHistory.map((entry) => (
                <li key={entry._id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-sm font-medium capitalize dark:text-gray-100">
                    {entry.status}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {getRelativeTimeString(entry.timestamp)}
                    </span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500">
                      {formatDateTime(entry.timestamp)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Statuses they set, in the app or via the iOS Shortcut, plus automatic
            timed transitions. The 04:00 reset clears a status without recording
            anything, so it doesn't appear here.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Signed-in devices
          </h3>
          {sessions === undefined ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No live sessions. They've either signed out, or haven't signed in on
              this device set since their last session expired.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {sessions.map((session) => (
                <li key={session.sessionId} className="py-3 space-y-1">
                  <p className="text-sm font-medium dark:text-gray-100">
                    {getRelativeTimeString(session.lastSeenAt)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Last active {formatDateTime(session.lastSeenAt)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Signed in {formatDateTime(session.startedAt)}
                    {session.refreshCount > 0 && ` · ${session.refreshCount} app opens since`}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            One entry per device that's currently signed in. Sessions disappear
            when a member signs out or the session expires, so this is a snapshot
            rather than a full sign-in history.
          </p>
        </div>
      </div>
    </ResponsiveModal>
  );
}

export default MemberActivity;
