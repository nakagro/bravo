import { usePaginatedQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { History } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface KitHistoryListProps {
  userId: Id<"users">;
}

const REASON_LABEL: Record<string, string> = {
  edited: "Changed",
  cleared: "Cleared",
  itemDeleted: "Item deleted",
  chartDeleted: "Size chart deleted",
  setDeleted: "Kit set deleted",
};

function dayLabel(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function timeLabel(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(timestamp),
  );
}

/**
 * Rendered entirely from the immutable snapshots the backend captured, never
 * re-resolved against live kit definitions, so a renamed or deleted chart
 * doesn't rewrite what happened.
 */
export function KitHistoryList({ userId }: KitHistoryListProps) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.memberKit.getMemberKitHistory,
    { userId },
    { initialNumItems: 25 },
  );

  if (status === "LoadingFirstPage") {
    return (
      <div className="space-y-2" aria-label="Loading history">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-8 text-red-600 dark:text-red-400" />}
        title="No changes yet"
        description="Recording kit against this member will show up here."
      />
    );
  }

  // Group by the officer's own calendar day.
  const groups: { day: string; rows: typeof results }[] = [];
  for (const row of results) {
    const day = dayLabel(row.changedAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else groups.push({ day, rows: [row] });
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.day} className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.day}
          </h3>
          <ul className="space-y-2">
            {group.rows.map((row) => (
              <li
                key={row._id}
                className="rounded-lg border border-border bg-background px-3 py-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">
                    {row.setName ? `${row.setName} · ${row.itemName}` : row.itemName}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeLabel(row.changedAt)}
                  </span>
                </div>
                <p className="text-sm [overflow-wrap:anywhere]">
                  <span className="text-muted-foreground">
                    {row.previousDisplay ?? "Not recorded"}
                  </span>
                  <span aria-hidden="true" className="mx-1.5 text-muted-foreground">
                    →
                  </span>
                  <span className="font-medium">{row.newDisplay ?? "Not recorded"}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {REASON_LABEL[row.reason] ?? row.reason} by {row.changedByName}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {status === "CanLoadMore" && (
        <Button variant="outline" className="min-h-11 w-full" onClick={() => loadMore(25)}>
          Load more
        </Button>
      )}
      {status === "LoadingMore" && <Skeleton className="h-14 w-full" />}
    </div>
  );
}
