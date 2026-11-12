import { useNavigate } from "react-router-dom";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { formatNightDate, nightLabel } from "../types";

export type Roll = FunctionReturnType<typeof api.training.listNights>[number];

/**
 * One roll in a list; tapping it opens that night. `backTo` is where the
 * night's back arrow returns, for lists that aren't the Roll tab. `flagOpen`
 * marks an open roll as unfinished, for lists of past rolls.
 */
export function RollRow({
  roll,
  backTo,
  flagOpen = false,
}: {
  roll: Roll;
  backTo?: string;
  flagOpen?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() =>
        navigate(`/training/${roll.date}`, backTo ? { state: { backTo } } : undefined)
      }
      className={cn(
        "w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/50 min-h-[44px]",
        roll.status === "cancelled" && "opacity-60"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="font-semibold text-foreground">{formatNightDate(roll.date)}</span>
          <span className="text-sm text-muted-foreground">{nightLabel(roll)}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{rollSummary(roll)}</p>
      </div>
      <StatusChip status={roll.status} flagOpen={flagOpen} />
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

export function rollSummary(roll: Roll): string {
  if (roll.status === "cancelled") return "Cancelled";
  const apologies = `${roll.apology} ${roll.apology === 1 ? "apology" : "apologies"}`;
  if (roll.status === "closed") {
    return `${roll.present} present · ${roll.absent} absent · ${apologies}`;
  }
  const parts = [];
  if (roll.present > 0) parts.push(`${roll.present} present`);
  if (roll.absent > 0) parts.push(`${roll.absent} absent`);
  if (roll.apology > 0) parts.push(apologies);
  return parts.length > 0 ? `${parts.join(" · ")} so far` : "No apologies yet";
}

function StatusChip({ status, flagOpen }: { status: Roll["status"]; flagOpen: boolean }) {
  if (status === "open" && !flagOpen) return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "closed"
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
          : status === "open"
            ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
            : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
      )}
    >
      {status === "closed" ? "Closed" : status === "open" ? "Not closed" : "Cancelled"}
    </span>
  );
}
