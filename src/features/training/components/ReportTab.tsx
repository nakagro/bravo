import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/shared/DatePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { SortableTableHeader } from "@/components/shared/SortableTableHeader";
import { BarChart3, Download } from "lucide-react";
import {
  attendanceRate,
  downloadCsv,
  formatNightDate,
  nightLabel,
  personName,
  rankLabel,
  shiftDays,
  todayStr,
} from "../types";

type Kind = "all" | "training" | "meeting";
type SortField = "roll" | "name" | "present" | "apology" | "absent" | "rate";

const KIND_SEGMENTS = [
  { key: "all", label: "All" },
  { key: "training", label: "Training" },
  { key: "meeting", label: "Meetings" },
] as const;

/**
 * Attendance per member over a date range, from closed rolls only. Opens in
 * roll order (seniority); every column sorts, and the CSV is what's on screen.
 */
export function ReportTab() {
  const [to, setTo] = useState(() => todayStr());
  const [from, setFrom] = useState(() => shiftDays(todayStr(), -91));
  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<{ field: SortField; direction: "asc" | "desc" }>({
    field: "roll",
    direction: "asc",
  });

  const report = useQuery(api.training.getReport, { from, to, kind });

  const rows = useMemo(() => {
    if (!report) return [];
    // The server returns roll order; "roll" keeps it
    const indexed = report.rows.map((row, index) => ({ ...row, index, rate: attendanceRate(row) }));
    const value = (row: (typeof indexed)[number]): string | number => {
      switch (sort.field) {
        case "name":
          return `${row.member.lastName} ${row.member.firstName}`.toLowerCase();
        case "roll":
          return row.index;
        default:
          return row[sort.field];
      }
    };
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...indexed].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return (va < vb ? -1 : va > vb ? 1 : a.index - b.index) * dir;
    });
  }, [report, sort]);

  const onSort = (field: SortField) =>
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : // Numbers read best highest-first
          { field, direction: field === "name" || field === "roll" ? "asc" : "desc" }
    );

  const exportCsv = () => {
    if (!report) return;
    downloadCsv(`attendance-${from}-to-${to}.csv`, [
      ["Name", "Rank", "CFA ID", "Present", "Apology", "Absent", "Attendance %"],
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
      currentField={sort.field}
      direction={sort.direction}
      onSort={onSort}
    />
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-sm font-medium">From</span>
          <DatePicker value={from} onChange={setFrom} />
        </div>
        <div className="space-y-1">
          <span className="text-sm font-medium">To</span>
          <DatePicker value={to} onChange={setTo} min={from} />
        </div>
      </div>

      <SegmentedTabs
        segments={KIND_SEGMENTS}
        value={kind}
        onChange={setKind}
        ariaLabel="Which nights"
      />

      {report === undefined ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : report.nights.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-10 w-10 text-red-400" />}
          title="No closed rolls in this range"
          description="Nights count here once their roll is closed."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {report.nights.length} {report.nights.length === 1 ? "night" : "nights"}:{" "}
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
                  <TableRow key={row.member.key}>
                    <TableCell className="px-4">
                      <div className="font-medium">{personName(row.member)}</div>
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
            Attendance is nights present out of nights the member was on the roll.
          </p>
        </>
      )}
    </div>
  );
}
