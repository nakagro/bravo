import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { MemberCombobox, MemberOption } from "./MemberCombobox";
import { Badge } from "@/components/ui/badge";
import { LoaderCircle, X } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { BARecordCard } from "./BARecordCard";

type UsageType = "firecall" | "drill";
type DateRange = "all" | "month" | "90d";

interface BASkillsHistoryTabProps {
  filterMemberId?: Id<"users"> | null;
  onClearMemberFilter?: () => void;
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

export function BASkillsHistoryTab({ filterMemberId, onClearMemberFilter }: BASkillsHistoryTabProps) {
  const records = useQuery(api.baRecords.listRecords, {
    memberId: filterMemberId ?? undefined,
  });
  const me = useQuery(api.baRecords.getCurrentUser);
  const members = useQuery(api.baRecords.listMembers);

  const [memberFilter, setMemberFilter] = useState<Id<"users"> | null>(null);
  const [typeFilter, setTypeFilter] = useState<UsageType | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateRange>("all");

  const memberOptions: MemberOption[] = useMemo(
    () => (members ?? []).map((m) => ({ _id: m._id, name: m.name, rank: m.rank })),
    [members],
  );

  const filteredMember = filterMemberId ? members?.find((m) => m._id === filterMemberId) : undefined;

  const visible = useMemo(() => {
    if (!records) return [];
    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    return records.filter((r) => {
      if (memberFilter && r.memberId !== memberFilter) return false;
      if (typeFilter !== "all" && r.usageType !== typeFilter) return false;
      if (dateFilter !== "all") {
        const t = new Date(r.dateUsed).getTime();
        if (dateFilter === "month" && t < monthStart.getTime()) return false;
        if (dateFilter === "90d" && t < ninetyDaysAgo) return false;
      }
      return true;
    });
  }, [records, memberFilter, typeFilter, dateFilter]);

  return (
    <div data-component="BASkillsHistoryTab">
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="px-3 py-3 space-y-4">
          {filteredMember && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 pl-2.5">
                Filtered to: {filteredMember.name}
                <button
                  onClick={onClearMemberFilter}
                  className="ml-1 rounded-full hover:bg-background/60 p-0.5"
                  aria-label="Clear member filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 w-full">
              <MemberCombobox
                label="Filter by member"
                options={memberOptions}
                value={memberFilter}
                onChange={setMemberFilter}
                placeholder="Search for a member"
                emptyText="No members found."
              />
            </div>
            {memberFilter && (
              <Button variant="ghost" size="sm" onClick={() => setMemberFilter(null)}>
                Clear
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  typeFilter === key
                    ? "bg-red-500 text-white border-red-500"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {DATE_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDateFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  dateFilter === key
                    ? "bg-red-500 text-white border-red-500"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
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
            <div className="space-y-3">
              {visible.map((record) => (
                <BARecordCard
                  key={record._id}
                  record={record}
                  canDelete={!!me && record.submittedBy === me._id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
