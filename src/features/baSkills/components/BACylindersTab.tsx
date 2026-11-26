import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Gauge, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

const QUICK_COUNTS = [1, 2, 3, 4, 5, 6];

function formatUpdatedAt(ts: number): string {
  return new Date(ts).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function BACylindersTab() {
  const notice = useQuery(api.stationNotices.getBaCylindersNotice);
  const setNotice = useMutation(api.stationNotices.setBaCylindersNotice);
  const clearNotice = useMutation(api.stationNotices.clearBaCylindersNotice);

  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const active = notice?.active ?? false;
  const serverCount = active ? (notice?.count ?? null) : null;
  const serverUpdatedAt = notice?.updatedAt ?? 0;

  useEffect(() => {
    setCount(serverCount);
  }, [serverCount, serverUpdatedAt]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await setNotice({
        ...(count !== null ? { count } : {}),
      });
      toast.success(
        active
          ? "Empty BA cylinder count updated"
          : "Empty BA cylinders flagged on the turnout screen",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update BA cylinder status");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      await clearNotice({});
      toast.success("Empty BA cylinders cleared from the turnout screen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear BA cylinder notice");
    } finally {
      setBusy(false);
    }
  };

  const bumpCount = (delta: number) => {
    setCount((prev) => {
      const next = (prev ?? 0) + delta;
      return next <= 0 ? null : Math.min(999, next);
    });
  };

  if (notice === undefined) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 text-sm text-gray-500 dark:text-gray-400">
        Loading cylinder status...
      </div>
    );
  }

  const countChanged = active && count !== serverCount;

  return (
    <div className="space-y-4 max-w-2xl" data-component="BACylindersTab">
      {/* Live status summary card */}
      <div
        className={`rounded-lg border p-4 sm:p-5 shadow-sm ${
          active
            ? "border-amber-500/60 bg-amber-50 dark:bg-amber-950/30"
            : "border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              active
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {active ? <Gauge className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
              {active
                ? notice?.count !== undefined
                  ? `Empty BA Cylinders (${notice.count})`
                  : "Empty BA Cylinders"
                : "No Empty BA Cylinders"}
            </h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {notice
                ? `${active ? "Flagged" : "Last cleared"}${notice.updatedByName ? ` by ${notice.updatedByName}` : ""} · ${formatUpdatedAt(notice.updatedAt)}`
                : "No empty cylinders currently flagged."}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {active
                ? "Showing on the station turnout idle screen and foyer kiosks."
                : "Flagging empty cylinders here updates the station turnout idle screen and foyer kiosks."}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white">
            Empty cylinders{" "}
            <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
          </label>
          <div className="mt-2 grid grid-cols-4 sm:grid-cols-7 gap-2">
            <button
              type="button"
              onClick={() => setCount(null)}
              disabled={busy}
              className={`rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors ${
                count === null
                  ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              Any
            </button>
            {QUICK_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                disabled={busy}
                className={`rounded-lg border px-2 py-2.5 text-base font-bold tabular-nums transition-colors ${
                  count === n
                    ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                    : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-700"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => bumpCount(-1)}
              disabled={busy || count === null}
              aria-label="Decrease cylinder count"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-28 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
              {count === null ? "Count not set" : `${count} cylinder${count === 1 ? "" : "s"}`}
            </span>
            <button
              type="button"
              onClick={() => bumpCount(1)}
              disabled={busy}
              aria-label="Increase cylinder count"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          {active ? (
            <>
              <button
                type="button"
                onClick={handleClear}
                disabled={busy}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {busy ? "Saving..." : "Clear Notice"}
              </button>
              {countChanged && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {busy ? "Saving..." : "Update Count"}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {busy
                ? "Saving..."
                : count !== null
                  ? `Flag ${count} Empty Cylinder${count === 1 ? "" : "s"}`
                  : "Flag Empty Cylinders"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
