import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ArrowPathIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatDateTime, getRelativeTimeString } from "@/utils/dateUtils";

const DAY = 24 * 60 * 60 * 1000;

// The nightly reset cron fires at a fixed UTC time (see convex/crons.ts:
// "nightly reset statuses", 18:30 UTC), which is 04:30 AEST / 05:30 AEDT.
const RESET_HOUR_UTC = 18;
const RESET_MINUTE_UTC = 30;

/**
 * Every nightly-reset instant strictly between two timestamps, oldest first.
 *
 * The reset clears statuses without writing history, so these are derived, not
 * recorded - we know when it ran because the cron time is fixed.
 */
function resetsBetween(afterMs: number, beforeMs: number): number[] {
  const out: number[] = [];
  const d = new Date(afterMs);
  // First candidate: the reset on the same UTC day as `afterMs`.
  let t = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    RESET_HOUR_UTC,
    RESET_MINUTE_UTC,
  );
  while (t <= afterMs) t += DAY;
  while (t < beforeMs) {
    out.push(t);
    t += DAY;
  }
  return out;
}

/**
 * "12 Jul, 3:04 pm" - the long-form `formatDateTime` blows out the narrow
 * secondary column on a phone, and the year is noise for recent activity.
 */
function formatCompact(timestamp: number): string {
  const d = new Date(timestamp);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "2-digit" }),
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
}

/** "5h 32m", "12m" - how long after the reset the member set a status. */
function formatGap(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

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
  const [includeInactive, setIncludeInactive] = useState(false);
  const [browserOnly, setBrowserOnly] = useState(false);
  const [openUser, setOpenUser] = useState<{ id: Id<"users">; name: string } | null>(null);

  const rows = useMemo(() => {
    if (!activity) return [];
    let visible = includeInactive
      ? activity
      : activity.filter((row) => !row.isShared && !row.isDisabled);
    if (browserOnly) visible = visible.filter((row) => row.phoneInstall === "browser-only");

    return [...visible].sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
  }, [activity, includeInactive, browserOnly]);

  const summary = useMemo(() => {
    const people = (activity ?? []).filter((row) => !row.isShared && !row.isDisabled);
    const now = Date.now();
    return {
      total: people.length,
      day: people.filter((r) => r.lastSeenAt && now - r.lastSeenAt < DAY).length,
      week: people.filter((r) => r.lastSeenAt && now - r.lastSeenAt < 7 * DAY).length,
      month: people.filter((r) => r.lastSeenAt && now - r.lastSeenAt < 30 * DAY).length,
      browserOnly: people.filter((r) => r.phoneInstall === "browser-only").length,
    };
  }, [activity]);

  if (activity === undefined) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 space-y-4">
      {showTitle && (
        <h2 className="text-xl font-semibold dark:text-white">Member Activity</h2>
      )}

      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {[
          { label: "Members", value: summary.total },
          { label: "Past 24h", value: summary.day },
          { label: "Past 7d", value: summary.week },
          { label: "Past 30d", value: summary.month },
        ].map((stat) => (
          <div
            key={stat.label}
            className="min-w-0 rounded-md border border-gray-200 p-2 dark:border-gray-700 sm:p-3"
          >
            <p className="text-lg font-semibold leading-tight dark:text-white sm:text-2xl">
              {stat.value}
            </p>
            <p className="whitespace-nowrap text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Switch
            id="browser-only"
            checked={browserOnly}
            onCheckedChange={setBrowserOnly}
            className="dark:data-[state=unchecked]:bg-gray-600"
          />
          <Label htmlFor="browser-only" className="text-sm dark:text-gray-200">
            Phone browser only ({summary.browserOnly})
          </Label>
        </div>
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
            {/* Name column flexes, the "last seen" column keeps its natural
                width, and nothing wraps into a stray right-aligned block. */}
            <button
              type="button"
              onClick={() => setOpenUser({ id: row.userId, name: row.name })}
              className="flex w-full items-center gap-2 rounded-md px-2 py-3 text-left transition-colors hover:bg-accent/50 min-h-[56px]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-medium dark:text-gray-100">{row.name}</span>
                  {row.rank && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{row.rank}</span>
                  )}
                  {row.isShared && <Badge variant="outline">Shared</Badge>}
                  {row.isDisabled && <Badge variant="destructive">Disabled</Badge>}
                  {row.phoneInstall === "browser-only" && (
                    <Badge
                      variant="outline"
                      className="border-amber-400 text-amber-700 dark:border-amber-600 dark:text-amber-300"
                      title="Opens BRAVO in a phone browser tab, not the installed app. Not receiving notifications on iPhone."
                    >
                      Phone browser only
                    </Badge>
                  )}
                  {row.phoneInstall === "installed" && (
                    <Badge
                      variant="outline"
                      className="border-green-400 text-green-700 dark:border-green-600 dark:text-green-300"
                    >
                      App installed
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-col gap-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400 sm:text-xs">
                  <span>
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      Signed-in devices:
                    </span>{" "}
                    {row.deviceCount}
                  </span>
                  <span>
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      Status last updated:
                    </span>{" "}
                    {row.lastStatusChangeAt
                      ? getRelativeTimeString(row.lastStatusChangeAt)
                      : "Never"}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 sm:text-[11px]">
                  Last seen
                </p>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-100 sm:text-sm">
                  {row.lastSeenAt ? getRelativeTimeString(row.lastSeenAt) : "Never"}
                </p>
              </div>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <MemberSessionsModal
        userId={openUser?.id ?? null}
        name={openUser?.name ?? ""}
        onClose={() => setOpenUser(null)}
      />

      {/* Folded away by default - it's a caveat, and on a phone it was as tall
          as several member rows. */}
      <details className="text-xs text-gray-500 dark:text-gray-400">
        <summary className="cursor-pointer py-1 select-none">
          What "last seen" actually means
        </summary>
        <p className="pt-1 leading-relaxed">
          Last seen is derived from sign-in sessions and the token refreshes the
          app makes while it's open, so it's accurate to roughly the hour and
          means "the app was running", not "they tapped something". Signing out
          or being disabled clears the session, which shows here as no live
          session.
        </p>
        <p className="pt-2 leading-relaxed">
          "Phone browser only" means every phone launch in the last 30 days was
          from a browser tab rather than the installed app, so on iPhone they are
          not receiving push notifications. "App installed" means at least one
          phone launch came from the installed app. Laptop use is ignored either
          way. Nothing is recorded until members are on a build that reports it.
        </p>
      </details>
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
              {statusHistory.map((entry, i) => {
                // Newest first, so "up" the list is forward in time.
                const upper = i === 0 ? Date.now() : statusHistory[i - 1].timestamp;
                // Resets since this entry (between it and the next change, or now).
                const resetsAfter = resetsBetween(entry.timestamp, upper);
                const lastReset = resetsAfter[resetsAfter.length - 1];
                return (
                  <li key={entry._id}>
                    {resetsAfter.length > 0 && (
                      <ResetMarker
                        timestamps={resetsAfter}
                        // Only the newest row can be "still waiting" - otherwise
                        // the entry above is what they set after the reset.
                        gapMs={i === 0 ? undefined : upper - lastReset}
                        pending={i === 0}
                      />
                    )}
                    <div className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0 truncate text-sm font-medium capitalize dark:text-gray-100">
                        {entry.status}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {getRelativeTimeString(entry.timestamp)}
                        </span>
                        <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                          {formatCompact(entry.timestamp)}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Statuses they set, in the app or via the iOS Shortcut, plus automatic
            timed transitions. The nightly reset clears a status without
            recording anything, so the reset lines are worked out from the cron's
            fixed time (04:30 AEST / 05:30 AEDT) rather than read from history.
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

/**
 * A "the nightly reset ran here" divider between two status entries.
 *
 * Nothing is stored for the reset, so this is inferred from the cron time - it
 * exists to make "not available overnight, available at 10am" legible as a
 * reset plus a response, and to show how long that response took.
 */
function ResetMarker({
  timestamps,
  gapMs,
  pending,
}: {
  timestamps: number[];
  gapMs?: number;
  pending: boolean;
}) {
  const latest = timestamps[timestamps.length - 1];
  const count = timestamps.length;
  const when =
    count === 1
      ? formatCompact(latest)
      : `${formatCompact(timestamps[0])} - ${formatCompact(latest)}`;

  return (
    // A banded row rather than centred text between rules: the text stays
    // left-aligned and wraps cleanly instead of ragging about on a phone.
    <div className="my-1 flex items-start gap-2 rounded-md border border-dashed border-amber-300/70 bg-amber-50/60 px-2.5 py-1.5 text-[11px] leading-snug text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-amber-400">
      <ArrowPathIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="font-medium">
          {count === 1 ? "Nightly reset" : `${count} nightly resets`}
        </span>
        <span className="text-amber-600/80 dark:text-amber-500/70"> · {when}</span>
        {gapMs !== undefined && (
          <span className="block font-medium">Status set {formatGap(gapMs)} later</span>
        )}
        {pending && <span className="block">No status set since</span>}
      </span>
    </div>
  );
}

export default MemberActivity;
