import { useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { History } from "lucide-react";
import { formatNightMonth, shiftDays, todayStr } from "../types";
import { RollRow, type Roll } from "./RollRow";

type Kind = "all" | "training" | "meeting";

const KIND_SEGMENTS = [
  { key: "all", label: "All" },
  { key: "training", label: "Training" },
  { key: "meeting", label: "Meetings" },
] as const;

// How many weeks each "Show earlier" reaches back
const PAGE_WEEKS = 26;

const BACK_TO = "/training?tab=previous";

const NO_ROLLS: Roll[] = [];

/**
 * Every roll before today, newest first under month headings. A roll nobody
 * closed is flagged here too, as well as on the Roll tab where it's chased.
 */
export function PreviousTab() {
  const today = useMemo(() => todayStr(), []);
  const [weeks, setWeeks] = useState(PAGE_WEEKS);
  const [kind, setKind] = useState<Kind>("all");

  // Tuesdays before the first roll anyone used predate the roll, so the list
  // never reaches past it
  const firstRollDate = useQuery(api.training.getFirstRollDate);
  const windowStart = shiftDays(today, -weeks * 7);
  const from = firstRollDate && firstRollDate > windowStart ? firstRollDate : windowStart;
  const to = shiftDays(today, -1);
  const hasPast = firstRollDate != null && from <= to;
  const result = useQuery(api.training.listNights, hasPast ? { from, to } : "skip");

  // Reaching further back re-runs the query; keep showing what's already there
  const lastResult = useRef<Roll[] | undefined>(undefined);
  if (result) lastResult.current = result;
  const rolls = hasPast ? (result ?? lastResult.current) : NO_ROLLS;

  const months = useMemo(() => {
    const groups: { month: string; rolls: Roll[] }[] = [];
    for (const roll of [...(rolls ?? [])].reverse()) {
      if (kind !== "all" && roll.kind !== kind) continue;
      const month = roll.date.slice(0, 7);
      const group = groups[groups.length - 1];
      if (group?.month === month) group.rolls.push(roll);
      else groups.push({ month, rolls: [roll] });
    }
    return groups;
  }, [rolls, kind]);

  if (firstRollDate === undefined || rolls === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (rolls.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-10 w-10 text-red-400" />}
        title="No previous rolls yet"
        description="Rolls move here the day after they're held."
      />
    );
  }

  const hasEarlier = firstRollDate !== null && firstRollDate < windowStart;

  return (
    <div className="space-y-4">
      <SegmentedTabs
        segments={KIND_SEGMENTS}
        value={kind}
        onChange={setKind}
        ariaLabel="Which nights"
      />

      {months.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No {kind === "meeting" ? "brigade meetings" : "training nights"} in this period.
        </p>
      )}

      {months.map((group) => (
        <section key={group.month} className="space-y-2" aria-label={formatNightMonth(group.month)}>
          <h2 className="text-sm font-semibold text-foreground">{formatNightMonth(group.month)}</h2>
          {group.rolls.map((roll) => (
            <RollRow key={roll.date} roll={roll} backTo={BACK_TO} flagOpen />
          ))}
        </section>
      ))}

      {hasEarlier && (
        <Button
          variant="outline"
          className="w-full"
          disabled={result === undefined}
          onClick={() => setWeeks((prev) => prev + PAGE_WEEKS)}
        >
          {result === undefined ? "Loading..." : "Show earlier rolls"}
        </Button>
      )}
    </div>
  );
}
