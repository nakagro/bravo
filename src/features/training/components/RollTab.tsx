import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { DatePicker } from "@/components/shared/DatePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { CalendarPlus, ClipboardCheck, TriangleAlert } from "lucide-react";
import { formatNightDateLong, nightLabel, shiftDays, todayStr } from "../types";
import { RollRow, rollSummary, type Roll } from "./RollRow";
import { errorMessage } from "@/lib/errors";

// How far back the tab looks for a roll nobody closed, and how far ahead it lists
const WEEKS_BACK = 8;
const WEEKS_AHEAD = 6;

/**
 * The Roll tab, arranged around what an officer is about to do: the next roll
 * first, then any past roll nobody closed, then what's coming (where the DO
 * records apologies ahead). Finished rolls live on the Previous tab.
 */
export function RollTab({ canManage }: { canManage: boolean }) {
  const today = useMemo(() => todayStr(), []);
  const rolls = useQuery(api.training.listNights, {
    from: shiftDays(today, -WEEKS_BACK * 7),
    to: shiftDays(today, WEEKS_AHEAD * 7),
  });
  const firstRollDate = useQuery(api.training.getFirstRollDate);
  const [addOpen, setAddOpen] = useState(false);

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
  // A past roll still open was never finished - the one thing here that needs
  // doing. Tuesdays before the first roll anyone used don't count: the brigade
  // wasn't using the roll yet, so nothing then was "never closed"
  const notClosed = canManage
    ? rolls
        .filter(
          (roll) =>
            roll.date < today &&
            roll.status === "open" &&
            firstRollDate !== null &&
            roll.date >= firstRollDate
        )
        .reverse()
    : [];

  return (
    <div className="space-y-6">
      {next ? (
        <NextRollCard roll={next} today={today} canManage={canManage} />
      ) : (
        <EmptyState
          icon={<ClipboardCheck />}
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
        description: errorMessage(error, "An unexpected error occurred."),
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
