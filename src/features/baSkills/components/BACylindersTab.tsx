import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Gauge, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

const QUICK_COUNTS = [1, 2, 3, 4, 5, 6];
const DETAIL_PRESETS = ["Used at fire call", "Used at training", "Low pressure"];
const MAX_DETAIL_LENGTH = 160;

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
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  const active = notice?.active ?? false;
  const serverCount = active ? (notice?.count ?? null) : null;
  const serverDetail = active ? (notice?.detail ?? "") : "";
  const serverUpdatedAt = notice?.updatedAt ?? 0;

  useEffect(() => {
    setCount(serverCount);
    setDetail(serverDetail);
  }, [serverCount, serverDetail, serverUpdatedAt]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await setNotice({
        ...(count !== null ? { count } : {}),
        ...(detail.trim() ? { detail: detail.trim() } : {}),
      });
      toast.success(
        active
          ? "BA cylinder refill notice updated"
          : "BA cylinders flagged for refill on the turnout screen",
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
      toast.success("BA cylinders marked filled and cleared from the turnout screen");
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

  return (
    <div className="space-y-4 max-w-2xl" data-component="BACylindersTab">
      {/* Live status summary card */}
      <div
        className={`rounded-lg border-2 p-4 sm:p-5 shadow-sm ${
          active
            ? "border-amber-500/70 bg-amber-50 dark:bg-amber-950/30"
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
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {active ? notice?.title ?? "BA Cylinders Need Filling" : "All BA Cylinders Full"}
              </h2>
              {active && notice?.count !== undefined && (
                <span className="inline-flex items-center rounded-full bg-amber-500 px-2.5 py-0.5 text-sm font-bold text-slate-950 tabular-nums">
                  {notice.count} cylinder{notice.count === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {active && notice?.detail && (
              <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{notice.detail}</p>
            )}
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {notice
                ? `${active ? "Flagged" : "Last cleared"}${notice.updatedByName ? ` by ${notice.updatedByName}` : ""} · ${formatUpdatedAt(notice.updatedAt)}`
                : "No refill notice currently active."}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {active
                ? "Showing on the station turnout idle screen and foyer kiosks."
                : "Flagging cylinders here updates the station turnout idle screen and foyer kiosks."}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-white">
            Cylinders needing refill{" "}
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

        <div>
          <label
            htmlFor="ba-cylinders-detail"
            className="block text-sm font-semibold text-gray-900 dark:text-white"
          >
            Note{" "}
            <span className="font-normal text-gray-500 dark:text-gray-400">(optional, max 160 chars)</span>
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DETAIL_PRESETS.map((preset) => {
              const selected = detail === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDetail(selected ? "" : preset)}
                  disabled={busy}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    selected
                      ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                      : "border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
          <input
            id="ba-cylinders-detail"
            type="text"
            value={detail}
            maxLength={MAX_DETAIL_LENGTH}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="e.g. Left on BA bench after Tuesday drill"
            disabled={busy}
            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
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
                {busy ? "Saving..." : "Mark All Filled (Clear)"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {busy ? "Saving..." : "Update Refill Notice"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {busy ? "Saving..." : "Flag Cylinders for Refill"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
