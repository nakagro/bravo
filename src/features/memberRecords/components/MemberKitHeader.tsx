import { Badge } from "@/components/ui/badge";

interface MemberKitHeaderProps {
  name: string;
  memberNumber?: string;
  rank?: string;
  latestActivity?: { changedAt: number; changedByName: string };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Localized, so the officer's own day/month order is used rather than a hardcoded one. */
export function formatKitDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

/**
 * The member's identity card. The app's first avatar treatment, so it stays
 * initials-only: no upload, no storage.
 */
export function MemberKitHeader({
  name,
  memberNumber,
  rank,
  latestActivity,
}: MemberKitHeaderProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <div
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400"
      >
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold">{name}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {rank && (
            <Badge variant="outline" className="font-normal">
              {rank}
            </Badge>
          )}
          {memberNumber && <span>#{memberNumber}</span>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {latestActivity
            ? `Updated ${formatKitDate(latestActivity.changedAt)} by ${latestActivity.changedByName}`
            : "Nothing recorded yet"}
        </p>
      </div>
    </div>
  );
}

interface CompletenessProps {
  recorded: number;
  total: number;
}

/**
 * Understated on purpose: this is not a compliance dashboard, and an
 * unrecorded item is not a fault. No percentage, no colour thresholds.
 */
export function KitCompleteness({ recorded, total }: CompletenessProps) {
  const pct = total === 0 ? 0 : Math.round((recorded / total) * 100);
  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-label="Kit recorded"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={recorded}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-red-600 transition-[width] motion-reduce:transition-none dark:bg-red-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {recorded} of {total} items recorded
      </p>
    </div>
  );
}
