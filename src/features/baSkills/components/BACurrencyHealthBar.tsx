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
  const atRisk = counts.expired + counts.warning;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onFilterChange(atRisk > 0 && counts.expired > 0 ? "expired" : "warning")}
          disabled={atRisk === 0}
          className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-left transition-colors enabled:hover:bg-red-100 disabled:cursor-default disabled:opacity-70 dark:border-red-900 dark:bg-red-950/20 dark:enabled:hover:bg-red-950/40"
        >
          <span className="block text-lg font-semibold text-red-700 dark:text-red-300">
            {atRisk}
          </span>
          <span className="text-red-700/80 dark:text-red-300/80">Need attention</span>
        </button>
        <button
          type="button"
          onClick={() => onFilterChange("current")}
          disabled={counts.current === 0}
          className="rounded-lg border border-green-200 bg-green-50/70 px-3 py-2 text-left transition-colors enabled:hover:bg-green-100 disabled:cursor-default disabled:opacity-70 dark:border-green-900 dark:bg-green-950/20 dark:enabled:hover:bg-green-950/40"
        >
          <span className="block text-lg font-semibold text-green-700 dark:text-green-300">
            {counts.current}
          </span>
          <span className="text-green-700/80 dark:text-green-300/80">Current with record</span>
        </button>
        <button
          type="button"
          onClick={() => onFilterChange("never_used")}
          disabled={counts.never_used === 0}
          className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-left transition-colors enabled:hover:bg-gray-100 disabled:cursor-default disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900/40 dark:enabled:hover:bg-gray-900"
        >
          <span className="block text-lg font-semibold text-gray-700 dark:text-gray-200">
            {counts.never_used}
          </span>
          <span className="text-gray-600 dark:text-gray-400">No BA record yet</span>
        </button>
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
      <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-1.5">
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={`flex min-w-0 items-center gap-1.5 rounded-md py-1 transition-opacity sm:rounded-none sm:py-0 ${
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
              className={`flex min-w-0 items-center gap-1.5 rounded-md py-1 transition-opacity sm:rounded-none sm:py-0 ${
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
