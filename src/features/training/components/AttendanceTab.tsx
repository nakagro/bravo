import { useMemo } from "react";
import { useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/shared/DatePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { SortableTableHeader } from "@/components/shared/SortableTableHeader";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronRight, Download } from "lucide-react";
import {
  MARK_LABELS,
  attendanceRate,
  downloadCsv,
  formatNightDate,
  nightLabel,
  personName,
  rankLabel,
  shiftDays,
  todayStr,
  type MarkStatus,
} from "../types";

type Report = FunctionReturnType<typeof api.training.getReport>;
type ReportRow = Report["rows"][number];
type Kind = "all" | "training" | "meeting";
type SortField = "roll" | "name" | "present" | "apology" | "absent" | "rate";

const KIND_SEGMENTS = [
  { key: "all", label: "All" },
  { key: "training", label: "Training" },
  { key: "meeting", label: "Meetings" },
] as const;

const SORT_FIELDS: SortField[] = ["roll", "name", "present", "apology", "absent", "rate"];

const MARK_CHIP: Record<MarkStatus, string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  apology: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  absent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
};

const isDate = (value: string | null): value is string =>
  value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Attendance per member over a date range, from closed rolls only. Opens in
 * roll order (seniority); every column sorts, and the CSV is what's on screen.
 * Tapping a member lists the nights behind their totals.
 *
 * The range, filter, sort and open member live in the URL, so coming back from
 * a night lands on the same view.
 */
export function AttendanceTab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => todayStr(), []);

  const presets = useMemo(
    () => [
      { label: "3 months", from: shiftDays(today, -91) },
      { label: "6 months", from: shiftDays(today, -182) },
      { label: "This year", from: `${today.slice(0, 4)}-01-01` },
    ],
    [today]
  );

  const paramTo = searchParams.get("to");
  const paramFrom = searchParams.get("from");
  const paramKind = searchParams.get("kind");
  const paramSort = searchParams.get("sort");
  const to = isDate(paramTo) ? paramTo : today;
  const from = isDate(paramFrom) ? paramFrom : presets[0].from;
  const kind: Kind = paramKind === "training" || paramKind === "meeting" ? paramKind : "all";
  const sortField: SortField = SORT_FIELDS.includes(paramSort as SortField)
    ? (paramSort as SortField)
    : "roll";
  const sortDirection: "asc" | "desc" = searchParams.get("dir") === "desc" ? "desc" : "asc";
  const memberKey = searchParams.get("member");

  // null clears a parameter back to its default
  const update = (patch: Record<string, string | null>) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true }
    );

  const report = useQuery(api.training.getReport, { from, to, kind });

  const rows = useMemo(() => {
    if (!report) return [];
    // The server returns roll order; "roll" keeps it
    const indexed = report.rows.map((row, index) => ({ ...row, index, rate: attendanceRate(row) }));
    const value = (row: (typeof indexed)[number]): string | number => {
      switch (sortField) {
        case "name":
          return `${row.member.lastName} ${row.member.firstName}`.toLowerCase();
        case "roll":
          return row.index;
        default:
          return row[sortField];
      }
    };
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...indexed].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return (va < vb ? -1 : va > vb ? 1 : a.index - b.index) * dir;
    });
  }, [report, sortField, sortDirection]);

  const onSort = (field: SortField) =>
    update({
      sort: field,
      dir:
        sortField === field
          ? sortDirection === "asc"
            ? "desc"
            : "asc"
          : // Numbers read best highest-first
            field === "name" || field === "roll"
            ? "asc"
            : "desc",
    });

  const exportCsv = () => {
    if (!report) return;
    downloadCsv(`attendance-${from}-to-${to}.csv`, [
      ["Name", "Rank", "CFA ID", "Present", "Apology", "Absent (no apology)", "Attendance %"],
      ...rows.map((row) => [
        personName(row.member),
        rankLabel(row.member),
        row.member.memberNumber ?? "",
        row.present,
        row.apology,
        row.absent,
        row.rate,
      ]),
    ]);
  };

  const header = (field: SortField, label: string) => (
    <SortableTableHeader
      field={field}
      label={label}
      currentField={sortField}
      direction={sortDirection}
      onSort={onSort}
    />
  );

  const selected = memberKey ? rows.find((row) => row.member.key === memberKey) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick ranges">
        {presets.map((preset) => {
          const active = from === preset.from && to === today;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              onClick={() => update({ from: preset.from, to: today })}
              className={cn(
                "min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors",
                active
                  ? "border-red-700 bg-red-700 text-white"
                  : "border-border bg-card text-foreground hover:bg-muted/50"
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-sm font-medium">From</span>
          <DatePicker value={from} onChange={(value) => update({ from: value })} />
        </div>
        <div className="space-y-1">
          <span className="text-sm font-medium">To</span>
          <DatePicker value={to} onChange={(value) => update({ to: value })} min={from} />
        </div>
      </div>

      <SegmentedTabs
        segments={KIND_SEGMENTS}
        value={kind}
        onChange={(value) => update({ kind: value === "all" ? null : value })}
        ariaLabel="Which nights"
      />

      {report === undefined ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : report.nights.length === 0 ? (
        <EmptyState
          icon={<BarChart3 />}
          title="No closed rolls in this range"
          description="A roll counts here once it has been closed."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {report.nights.length} {report.nights.length === 1 ? "roll" : "rolls"}:{" "}
              {formatNightDate(report.nights[0].date)} to{" "}
              {formatNightDate(report.nights[report.nights.length - 1].date)}
              {kind === "all" &&
                report.nights.some((n) => n.kind === "other") &&
                ` (includes ${report.nights
                  .filter((n) => n.kind === "other")
                  .map(nightLabel)
                  .join(", ")})`}
            </p>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {header("roll", "Member")}
                  {header("present", "Present")}
                  {header("apology", "Apology")}
                  {header("absent", "Absent")}
                  {header("rate", "Attendance")}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.member.key}
                    className="cursor-pointer"
                    onClick={() => update({ member: row.member.key })}
                  >
                    <TableCell className="px-4">
                      {/* The row is the tap target; the button makes it reachable by keyboard */}
                      <button type="button" className="text-left font-medium">
                        {personName(row.member)}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        {[rankLabel(row.member), !row.member.isActive && "Removed from roll"]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 tabular-nums">{row.present}</TableCell>
                    <TableCell className="px-4 tabular-nums">{row.apology}</TableCell>
                    <TableCell className="px-4 tabular-nums">{row.absent}</TableCell>
                    <TableCell className="px-4 tabular-nums">{row.rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Tap a member to see their nights. Absent means absent without an apology. Attendance
            is nights present out of nights the member was on the roll.
          </p>
        </>
      )}

      {report && selected && (
        <MemberNightsModal
          row={selected}
          rate={selected.rate}
          nights={report.nights}
          onClose={() => update({ member: null })}
          onOpenNight={(date) =>
            navigate(`/training/${date}`, {
              state: { backTo: `/training?${searchParams.toString()}` },
            })
          }
        />
      )}
    </div>
  );
}

/** The nights behind one member's totals, newest first; each opens that roll. */
function MemberNightsModal({
  row,
  rate,
  nights,
  onClose,
  onOpenNight,
}: {
  row: ReportRow;
  rate: number;
  nights: Report["nights"];
  onClose: () => void;
  onOpenNight: (date: string) => void;
}) {
  const nightByDate = new Map(nights.map((night) => [night.date, night]));
  const apologies = `${row.apology} ${row.apology === 1 ? "apology" : "apologies"}`;

  return (
    <ResponsiveModal open onClose={onClose} title={personName(row.member)}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {row.present} present · {row.absent} absent · {apologies} · {rate}% attendance
        </p>
        <ul className="space-y-2">
          {[...row.marks].reverse().map((mark) => {
            const night = nightByDate.get(mark.date);
            return (
              <li key={mark.date}>
                <button
                  type="button"
                  onClick={() => onOpenNight(mark.date)}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold text-foreground">
                        {formatNightDate(mark.date)}
                      </span>
                      {night && (
                        <span className="text-sm text-muted-foreground">{nightLabel(night)}</span>
                      )}
                    </div>
                    {mark.note && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{mark.note}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      MARK_CHIP[mark.status]
                    )}
                  >
                    {MARK_LABELS[mark.status]}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ResponsiveModal>
  );
}
