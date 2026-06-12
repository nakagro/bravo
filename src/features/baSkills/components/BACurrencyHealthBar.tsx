import { CurrencyStatus, STATUS_META } from "../lib/currency";
import { CurrencyCounts, CurrencyFilter, STATUS_GROUP_ORDER } from "../lib/types";

interface BACurrencyHealthBarProps {
  counts: CurrencyCounts;
  activeFilter: CurrencyFilter;
  onFilterChange: (filter: CurrencyFilter) => void;
}

function statusMatchesFilter(status: CurrencyStatus, filter: CurrencyFilter) {
  if (filter === "all") return true;
  if (filter === "at_risk") return status === "expired" || status === "warning";
  return status === filter;
}

export function BACurrencyHealthBar({
  counts,
  activeFilter,
  onFilterChange,
}: BACurrencyHealthBarProps) {
  const total = counts.total || 1;
  const atRisk = counts.expired + counts.warning;

  const toggle = (filter: CurrencyFilter) =>
    onFilterChange(activeFilter === filter ? "all" : filter);

  const activeRing = "ring-2 ring-offset-1 ring-offset-background";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-[11px] leading-tight sm:text-xs">
        <button
          type="button"
          onClick={() => toggle("at_risk")}
          disabled={atRisk === 0}
          aria-pressed={activeFilter === "at_risk"}
          className={`rounded-lg border border-red-200 bg-red-50/70 px-2 py-2 text-left transition-colors enabled:hover:bg-red-100 disabled:cursor-default disabled:opacity-70 dark:border-red-900 dark:bg-red-950/20 dark:enabled:hover:bg-red-950/40 sm:px-3 ${
            activeFilter === "at_risk" ? `${activeRing} ring-red-400` : ""
          }`}
        >
          <span className="block text-base font-semibold text-red-700 dark:text-red-300 sm:text-lg">
            {atRisk}
          </span>
          <span className="text-red-700/80 dark:text-red-300/80">Need attention</span>
        </button>
        <button
          type="button"
          onClick={() => toggle("current")}
          disabled={counts.current === 0}
          aria-pressed={activeFilter === "current"}
          className={`rounded-lg border border-green-200 bg-green-50/70 px-2 py-2 text-left transition-colors enabled:hover:bg-green-100 disabled:cursor-default disabled:opacity-70 dark:border-green-900 dark:bg-green-950/20 dark:enabled:hover:bg-green-950/40 sm:px-3 ${
            activeFilter === "current" ? `${activeRing} ring-green-400` : ""
          }`}
        >
          <span className="block text-base font-semibold text-green-700 dark:text-green-300 sm:text-lg">
            {counts.current}
          </span>
          <span className="text-green-700/80 dark:text-green-300/80">Current with record</span>
        </button>
        <button
          type="button"
          onClick={() => toggle("never_used")}
          disabled={counts.never_used === 0}
          aria-pressed={activeFilter === "never_used"}
          className={`rounded-lg border border-gray-200 bg-gray-50/80 px-2 py-2 text-left transition-colors enabled:hover:bg-gray-100 disabled:cursor-default disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900/40 dark:enabled:hover:bg-gray-900 sm:px-3 ${
            activeFilter === "never_used" ? `${activeRing} ring-gray-400` : ""
          }`}
        >
          <span className="block text-base font-semibold text-gray-700 dark:text-gray-200 sm:text-lg">
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
          const dim = activeFilter !== "all" && !statusMatchesFilter(status, activeFilter);
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggle(status)}
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
              onClick={() => toggle(status)}
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
