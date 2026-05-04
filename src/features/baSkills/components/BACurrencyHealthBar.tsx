import { CurrencyStatus, STATUS_META } from "../lib/currency";
import { CurrencyCounts, STATUS_GROUP_ORDER } from "../lib/types";

interface BACurrencyHealthBarProps {
  counts: CurrencyCounts;
  activeFilter: CurrencyStatus | "all";
  onFilterChange: (filter: CurrencyStatus | "all") => void;
}

export function BACurrencyHealthBar({
  counts,
  activeFilter,
  onFilterChange,
}: BACurrencyHealthBarProps) {
  const total = counts.total || 1;
  const currentPct = Math.round((counts.current / total) * 100);
  const atRisk = counts.expired + counts.warning;

  return (
    <div className="space-y-3">
      {/* Headline */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{currentPct}%</span>
            <span className="text-sm text-muted-foreground">
              currency rate · {counts.total} member{counts.total === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {atRisk > 0 ? (
          <button
            onClick={() => onFilterChange(counts.expired > 0 ? "expired" : "warning")}
            className="inline-flex items-center gap-2 rounded-full border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-1 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            {atRisk} member{atRisk === 1 ? "" : "s"} need attention
          </button>
        ) : counts.total > 0 ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-300">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            All members on track
          </span>
        ) : null}
      </div>

      {/* Stacked bar */}
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
        role="img"
        aria-label="Brigade BA currency status distribution"
      >
        {STATUS_GROUP_ORDER.map((status) => {
          const count = counts[status];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          const meta = STATUS_META[status];
          const isActive = activeFilter === status;
          const dim = activeFilter !== "all" && !isActive;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onFilterChange(isActive ? "all" : status)}
              style={{ width: `${pct}%` }}
              className={`${meta.solidClass} transition-opacity hover:opacity-80 first:rounded-l-full last:rounded-r-full ${
                dim ? "opacity-40" : "opacity-100"
              }`}
              aria-label={`${meta.label}: ${count} (${Math.round(pct)}%)`}
              title={`${meta.label}: ${count} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>

      {/* Legend / clickable status chips */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={`flex items-center gap-1.5 transition-opacity ${
            activeFilter === "all" ? "opacity-100 font-medium" : "opacity-70 hover:opacity-100"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-foreground/40" />
          <span className="text-foreground">All</span>
          <span className="text-muted-foreground">({counts.total})</span>
        </button>
        {STATUS_GROUP_ORDER.map((status) => {
          const meta = STATUS_META[status];
          const count = counts[status];
          const isActive = activeFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onFilterChange(isActive ? "all" : status)}
              className={`flex items-center gap-1.5 transition-opacity ${
                isActive ? "opacity-100 font-medium" : "opacity-70 hover:opacity-100"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${meta.solidClass}`} />
              <span className="text-foreground">{meta.label}</span>
              <span className="text-muted-foreground">({count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
