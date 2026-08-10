import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "../lib/currency";
import { CurrencyMember, SIX_MONTHS_DAYS } from "../lib/types";
import { Id } from "../../../../convex/_generated/dataModel";

interface BACurrencyRowProps {
  member: CurrencyMember;
  onViewHistory?: (userId: Id<"users">) => void;
}

export function BACurrencyRow({ member, onViewHistory }: BACurrencyRowProps) {
  const meta = STATUS_META[member.status];

  // Progress: how much of the 6-month window remains
  const remaining =
    member.daysUntilExpiry === undefined
      ? 0
      : Math.max(0, Math.min(SIX_MONTHS_DAYS, member.daysUntilExpiry));
  const pct = (remaining / SIX_MONTHS_DAYS) * 100;

  let primaryText: string;
  if (member.status === "never_used") {
    primaryText = "No usage yet";
  } else if (member.status === "expired") {
    primaryText = `Expired ${Math.abs(member.daysUntilExpiry ?? 0)}d ago`;
  } else {
    primaryText = `${member.daysUntilExpiry}d left`;
  }

  const secondaryText = member.lastUsageDate
    ? `Last used ${format(new Date(member.lastUsageDate), "d MMM yyyy")}`
    : null;

  const interactive = !!onViewHistory;
  const Wrapper: React.ElementType = interactive ? "button" : "div";

  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={interactive ? () => onViewHistory!(member.userId) : undefined}
      className={`group block w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 px-3 py-3 transition-colors ${
        interactive ? "hover:bg-gray-50 dark:hover:bg-gray-700/40 active:bg-gray-100 dark:active:bg-gray-700/60 cursor-pointer" : ""
      }`}
    >
      {/* Top row: dot · name + skills · days text · chevron */}
      <div className="flex items-center gap-2.5">
        <span
          className={`shrink-0 h-2.5 w-2.5 rounded-full ${meta.solidClass}`}
          aria-label={meta.label}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-sm text-foreground truncate">{member.userName}</span>
            <div className="flex gap-1">
              {member.skills.map((skill) => (
                <Badge
                  key={skill}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 leading-4"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <span className={`shrink-0 text-xs font-semibold tabular-nums ${meta.textClass}`}>
          {primaryText}
        </span>
        {interactive && (
          <ChevronRight className="shrink-0 h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </div>

      {/* Progress bar - full width, visible on all viewports */}
      <div className="mt-2 flex items-center gap-2">
        <div
          className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className={`h-full ${meta.fillClass} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {secondaryText && (
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {secondaryText}
          </span>
        )}
      </div>
    </Wrapper>
  );
}
