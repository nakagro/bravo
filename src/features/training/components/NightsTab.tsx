import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { DatePicker } from "@/components/shared/DatePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { CalendarPlus, ChevronRight, ClipboardCheck } from "lucide-react";
import { formatNightDate, nightLabel, shiftDays, todayStr } from "../types";

type NightSummary = FunctionReturnType<typeof api.training.listNights>[number];

// How far either side of today the list reaches. Older nights are still
// reachable through the report.
const WEEKS_BACK = 8;
const WEEKS_AHEAD = 6;

export function NightsTab({ canManage }: { canManage: boolean }) {
  const today = useMemo(() => todayStr(), []);
  const nights = useQuery(api.training.listNights, {
    from: shiftDays(today, -WEEKS_BACK * 7),
    to: shiftDays(today, WEEKS_AHEAD * 7),
  });
  const [addOpen, setAddOpen] = useState(false);

  const upcoming = (nights ?? []).filter((night) => night.date >= today);
  const past = (nights ?? []).filter((night) => night.date < today).reverse();

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" aria-hidden="true" />
            Add one-off night
          </Button>
        </div>
      )}

      {nights === undefined ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : nights.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-10 w-10 text-red-400" />}
          title="No roll nights"
          description="Every Tuesday appears here automatically."
        />
      ) : (
        <>
          <NightList title="Coming up" nights={upcoming} today={today} />
          <NightList title="Recent" nights={past} today={today} />
        </>
      )}

      {addOpen && <AddNightModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function NightList({
  title,
  nights,
  today,
}: {
  title: string;
  nights: NightSummary[];
  today: string;
}) {
  const navigate = useNavigate();
  if (nights.length === 0) return null;

  return (
    <section className="space-y-2" aria-label={title}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {nights.map((night) => (
        <button
          key={night.date}
          onClick={() => navigate(`/training/${night.date}`)}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/50 min-h-[44px]",
            night.status === "cancelled" && "opacity-60"
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{formatNightDate(night.date)}</span>
              <span className="text-sm text-muted-foreground">{nightLabel(night)}</span>
              {night.date === today && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  Tonight
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{nightSummary(night)}</p>
          </div>
          <StatusChip status={night.status} />
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}

function nightSummary(night: NightSummary): string {
  if (night.status === "cancelled") return "Cancelled";
  if (night.status === "closed") {
    return `${night.present} present · ${night.apology} apologies · ${night.absent} absent`;
  }
  const parts = [];
  if (night.present > 0) parts.push(`${night.present} present`);
  if (night.apology > 0) parts.push(`${night.apology} ${night.apology === 1 ? "apology" : "apologies"}`);
  return parts.length > 0 ? `${parts.join(" · ")} so far` : "Nothing recorded yet";
}

function StatusChip({ status }: { status: NightSummary["status"] }) {
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
      {status === "closed" ? "Roll closed" : "Cancelled"}
    </span>
  );
}

function AddNightModal({ onClose }: { onClose: () => void }) {
  const addNight = useMutation(api.training.addNight);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await addNight({ date, title });
      toast.success("Roll night added");
      onClose();
    } catch (error) {
      toast.error("Couldn't add the night", {
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
      title="Add a one-off night"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !date || !title.trim()}>
            {saving ? "Adding..." : "Add night"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          For a roll on a night that isn&apos;t a Tuesday - Tuesdays are already on the list.
        </p>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="night-title">
            Name
          </label>
          <input
            id="night-title"
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
