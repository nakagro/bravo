import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { DatePicker } from "@/components/shared/DatePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { CalendarPlus, ChevronDown, ChevronRight, ClipboardCheck, TriangleAlert } from "lucide-react";
import { formatNightDate, formatNightDateLong, nightLabel, shiftDays, todayStr } from "../types";

type Roll = FunctionReturnType<typeof api.training.listNights>[number];

// How far either side of today the tab reaches. Anything older is in Attendance.
const WEEKS_BACK = 8;
const WEEKS_AHEAD = 6;

/**
 * The Roll tab, arranged around what an officer is about to do: the next roll
 * first, then any past roll nobody closed, then what's coming (where the DO
 * records apologies ahead), with the history folded away at the bottom.
 */
export function RollTab({ canManage }: { canManage: boolean }) {
  const today = useMemo(() => todayStr(), []);
  const rolls = useQuery(api.training.listNights, {
    from: shiftDays(today, -WEEKS_BACK * 7),
    to: shiftDays(today, WEEKS_AHEAD * 7),
  });
  const firstRollDate = useQuery(api.training.getFirstRollDate);
  const [addOpen, setAddOpen] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);

  if (rolls === undefined || firstRollDate === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-36 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  const upcoming = rolls.filter((roll) => roll.date >= today);
  const next = upcoming.find((roll) => roll.status !== "cancelled") ?? upcoming[0];
  const comingUp = upcoming.filter((roll) => roll !== next);
  // Past Tuesdays only exist from the first roll anyone used. Before that the
  // brigade wasn't using the roll at all, so there's nothing to list - and
  // nothing that was "never closed"
  const past = rolls
    .filter((roll) => roll.date < today && firstRollDate !== null && roll.date >= firstRollDate)
    .reverse();
  // A past roll still open was never finished - the one thing here that needs doing
  const notClosed = canManage ? past.filter((roll) => roll.status === "open") : [];
  const previous = past.filter((roll) => !notClosed.includes(roll));

  return (
    <div className="space-y-6">
      {next ? (
        <NextRollCard roll={next} today={today} canManage={canManage} />
      ) : (
        <EmptyState
          icon={<ClipboardCheck className="h-10 w-10 text-red-400" />}
          title="No rolls coming up"
          description="Every Tuesday appears here automatically."
        />
      )}

      {notClosed.length > 0 && (
        <section
          aria-label="Not closed yet"
          className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            Not closed yet
          </h2>
          <p className="text-xs text-amber-800 dark:text-amber-200">
            These rolls haven&apos;t been closed, so they don&apos;t count in Attendance yet.
          </p>
          {notClosed.map((roll) => (
            <RollRow key={roll.date} roll={roll} />
          ))}
        </section>
      )}

      {comingUp.length > 0 && (
        <section className="space-y-2" aria-label="Coming up">
          <h2 className="text-sm font-semibold text-foreground">Coming up</h2>
          {comingUp.map((roll) => (
            <RollRow key={roll.date} roll={roll} />
          ))}
        </section>
      )}

      {canManage && (
        <Button variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
          <CalendarPlus className="h-4 w-4 mr-2" aria-hidden="true" />
          Add an extra roll
        </Button>
      )}

      {previous.length > 0 && (
        <section className="space-y-2" aria-label="Previous rolls">
          <button
            onClick={() => setShowPrevious((prev) => !prev)}
            aria-expanded={showPrevious}
            className="flex w-full items-center gap-2 text-left min-h-[44px]"
          >
            <span className="text-sm font-semibold text-foreground">Previous rolls</span>
            <span className="text-xs text-muted-foreground">{previous.length}</span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                showPrevious && "rotate-180"
              )}
            />
          </button>
          {showPrevious && previous.map((roll) => <RollRow key={roll.date} roll={roll} />)}
        </section>
      )}

      {addOpen && <AddRollModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function NextRollCard({
  roll,
  today,
  canManage,
}: {
  roll: Roll;
  today: string;
  canManage: boolean;
}) {
  const navigate = useNavigate();
  const isTonight = roll.date === today;

  return (
    <Card className="border-red-200 dark:border-red-900/60">
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
            {isTonight ? "Tonight" : "Next roll"}
          </p>
          <h2 className="text-xl font-bold text-foreground">{nightLabel(roll)}</h2>
          <p className="text-sm text-muted-foreground">{formatNightDateLong(roll.date)}</p>
        </div>
        <p className="text-sm text-foreground/80">{rollSummary(roll)}</p>
        {roll.status !== "cancelled" && (
          <Button
            size="lg"
            className="w-full bg-red-700 hover:bg-red-800"
            onClick={() => navigate(`/training/${roll.date}`)}
          >
            {canManage
              ? roll.status === "closed"
                ? "View the roll"
                : "Take the roll"
              : "Record apologies"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RollRow({ roll }: { roll: Roll }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/training/${roll.date}`)}
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
      <StatusChip status={roll.status} />
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function rollSummary(roll: Roll): string {
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

function StatusChip({ status }: { status: Roll["status"] }) {
  if (status === "open") return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "closed"
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
          : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
      )}
    >
      {status === "closed" ? "Closed" : "Cancelled"}
    </span>
  );
}

function AddRollModal({ onClose }: { onClose: () => void }) {
  const addNight = useMutation(api.training.addNight);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await addNight({ date, title });
      toast.success("Extra roll added");
      onClose();
    } catch (error) {
      toast.error("Couldn't add the roll", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title="Add an extra roll"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !date || !title.trim()}>
            {saving ? "Adding..." : "Add roll"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          For a roll on a day that isn&apos;t a Tuesday, such as a joint exercise. Tuesdays are
          already on the list.
        </p>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="roll-title">
            Name
          </label>
          <input
            id="roll-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Joint exercise"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">Date</span>
          <DatePicker value={date} onChange={setDate} placeholder="Select date" />
        </div>
      </div>
    </ResponsiveModal>
  );
}
