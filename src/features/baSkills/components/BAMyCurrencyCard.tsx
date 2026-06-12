import { addDays, format } from "date-fns";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "../lib/currency";
import { SIX_MONTHS_DAYS } from "../lib/types";

function nudgeText(
  status: "current" | "warning" | "expired" | "never_used",
  lastUsageDate?: string,
) {
  switch (status) {
    case "never_used":
      return "Log your first BA wear to start your currency.";
    case "expired":
      return "Log a BA wear to regain currency.";
    default: {
      if (!lastUsageDate) return null;
      const logBy = addDays(new Date(lastUsageDate), SIX_MONTHS_DAYS);
      return `Log a BA wear before ${format(logBy, "d MMM yyyy")} to stay current.`;
    }
  }
}

export function BAMyCurrencyCard() {
  const currency = useQuery(api.baCurrency.getMyCurrency);

  if (currency === undefined) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  if (currency === null) return null;

  if (!currency.hasBASkills) {
    return (
      <div className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
        No BA qualification is recorded on your profile, so currency isn't tracked for you.
      </div>
    );
  }

  const meta = STATUS_META[currency.status];
  const Icon = meta.icon;

  const remaining =
    currency.daysUntilExpiry === undefined
      ? 0
      : Math.max(0, Math.min(SIX_MONTHS_DAYS, currency.daysUntilExpiry));
  const pct = (remaining / SIX_MONTHS_DAYS) * 100;

  let headline: string;
  if (currency.status === "never_used") {
    headline = "No BA usage recorded yet";
  } else if (currency.status === "expired") {
    headline = `Currency expired ${Math.abs(currency.daysUntilExpiry ?? 0)} days ago`;
  } else {
    headline = `${currency.daysUntilExpiry} days of currency remaining`;
  }

  const nudge = nudgeText(currency.status, currency.lastUsageDate);

  return (
    <div className={`rounded-lg border bg-card p-4 shadow-sm ${meta.cardBorderClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Icon className={`h-5 w-5 ${meta.textClass}`} />
        <span className="font-semibold text-foreground">Your BA currency</span>
        <Badge className={meta.badgeClass}>{meta.label}</Badge>
        <div className="ml-auto flex gap-1">
          {currency.skills.map((skill) => (
            <Badge key={skill} variant="outline" className="text-[10px] px-1.5 py-0 leading-4">
              {skill}
            </Badge>
          ))}
        </div>
      </div>

      <p className={`mt-2 text-sm font-medium ${meta.textClass}`}>{headline}</p>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={SIX_MONTHS_DAYS}
        aria-valuenow={remaining}
        aria-label="Days of BA currency remaining"
      >
        <div className={`h-full ${meta.fillClass} transition-all`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {currency.lastUsageDate ? (
          <span>Last wear {format(new Date(currency.lastUsageDate), "d MMM yyyy")}</span>
        ) : (
          <span>No wears logged</span>
        )}
        {nudge && <span>{nudge}</span>}
      </div>
    </div>
  );
}
