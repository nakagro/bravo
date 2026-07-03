import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { MemberCombobox, MemberOption } from "./MemberCombobox";
import { Download, LoaderCircle } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { BARecordCard } from "./BARecordCard";
import { buildRecordsCsv, downloadCsv } from "../lib/csv";
import { isWithinBARecordDeleteWindow, useBARecordDeleteWindowNow } from "../lib/deletePermissions";

type UsageType = "firecall" | "drill";
type DateRange = "all" | "month" | "90d";

interface BASkillsHistoryTabProps {
  filterMemberId?: Id<"users"> | null;
  onMemberFilterChange?: (memberId: Id<"users"> | null) => void;
  canManageRecords?: boolean;
}

const TYPE_FILTERS: Array<{ key: UsageType | "all"; label: string }> = [
  { key: "all", label: "All types" },
  { key: "firecall", label: "Fire Call" },
  { key: "drill", label: "Drill" },
];

const DATE_FILTERS: Array<{ key: DateRange; label: string }> = [
  { key: "all", label: "All time" },
  { key: "month", label: "This month" },
  { key: "90d", label: "Last 90 days" },
];

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

export function BASkillsHistoryTab({
  filterMemberId,
  onMemberFilterChange,
  canManageRecords = false,
}: BASkillsHistoryTabProps) {
  const records = useQuery(api.baRecords.listRecords, {
    memberId: filterMemberId ?? undefined,
  });
  const me = useQuery(api.baRecords.getCurrentUser);
  const members = useQuery(api.baRecords.listMembers, {});
  const now = useBARecordDeleteWindowNow();

  const [typeFilter, setTypeFilter] = useState<UsageType | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateRange>("all");

  const memberOptions: MemberOption[] = useMemo(
    () => (members ?? []).map((m) => ({ _id: m._id, name: m.name, rank: m.rank })),
    [members],
  );

  const visible = useMemo(() => {
    if (!records) return [];
    const nowMs = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const ninetyDaysAgo = nowMs - 90 * 24 * 60 * 60 * 1000;

    return records
      .filter((r) => {
        if (typeFilter !== "all" && r.usageType !== typeFilter) return false;
        if (dateFilter !== "all") {
          const t = new Date(r.dateUsed).getTime();
          if (dateFilter === "month" && t < monthStart.getTime()) return false;
          if (dateFilter === "90d" && t < ninetyDaysAgo) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.dateUsed).getTime() - new Date(a.dateUsed).getTime());
  }, [records, typeFilter, dateFilter]);

  // Group the filtered records by calendar month for scannable section headers
  const monthGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; records: typeof visible }> = [];
    for (const record of visible) {
      const date = new Date(record.dateUsed);
      const key = format(date, "yyyy-MM");
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.records.push(record);
      } else {
        groups.push({ key, label: format(date, "MMMM yyyy"), records: [record] });
      }
    }
    return groups;
  }, [visible]);

  const handleExport = () => {
    if (visible.length === 0) return;
    downloadCsv(buildRecordsCsv(visible), "ba-records");
  };

  return (
    <div className="space-y-4" data-component="BASkillsHistoryTab">
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded px-3 py-3 sm:px-4 sm:py-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 w-full">
            <MemberCombobox
              label="Filter by member"
              options={memberOptions}
              value={filterMemberId ?? null}
              onChange={(id) => onMemberFilterChange?.(id)}
              placeholder="Search for a member"
              emptyText="No members found."
            />
          </div>
          {filterMemberId && (
            <Button variant="ghost" size="sm" onClick={() => onMemberFilterChange?.(null)}>
              Clear
            </Button>
          )}
        </div>

        <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {TYPE_FILTERS.map(({ key, label }) => (
            <FilterChip
              key={key}
              active={typeFilter === key}
              label={label}
              onClick={() => setTypeFilter(key)}
            />
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
          {DATE_FILTERS.map(({ key, label }) => (
            <FilterChip
              key={key}
              active={dateFilter === key}
              label={label}
              onClick={() => setDateFilter(key)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {records === undefined
              ? "Loading records..."
              : visible.length === 1
                ? "1 record matches"
                : `${visible.length} records match`}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={visible.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </div>
      </div>

      {records === undefined ? (
        <div className="flex items-center justify-center p-8">
          <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {records.length === 0
            ? "No BA records have been logged yet."
            : "No records match the current filters."}
        </div>
      ) : (
        <div className="space-y-5">
          {monthGroups.map((group) => (
            <section key={group.key} aria-label={group.label} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                <span className="text-xs text-muted-foreground">
                  {group.records.length === 1 ? "1 record" : `${group.records.length} records`}
                </span>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </div>
              {group.records.map((record) => (
                <BARecordCard
                  key={record._id}
                  record={record}
                  canDelete={
                    canManageRecords ||
                    (!!me &&
                      record.submittedBy === me._id &&
                      isWithinBARecordDeleteWindow(record.createdAt, now))
                  }
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
