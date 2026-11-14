import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PartyPopper } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { CurrencyStatus } from "../lib/currency";
import {
  CurrencyFilter,
  CurrencyMember,
  DEFAULT_GROUP_OPEN,
  STATUS_GROUP_ORDER,
  SortKey,
} from "../lib/types";
import { buildCurrencyCsv, downloadCsv } from "../lib/csv";
import { BACurrencyHealthBar } from "./BACurrencyHealthBar";
import { BACurrencyToolbar } from "./BACurrencyToolbar";
import { BACurrencyGroup } from "./BACurrencyGroup";
import { BACurrencyRow } from "./BACurrencyRow";
import { MemberOption } from "@/components/shared/MemberCombobox";
import { Spinner } from "@/components/ui/spinner";

interface BASkillsCurrencyTabProps {
  onViewMemberHistory?: (userId: Id<"users">) => void;
}

const STATUS_RANK: Record<CurrencyStatus, number> = {
  expired: 0,
  warning: 1,
  never_used: 2,
  current: 3,
};

function sortMembers(members: CurrencyMember[], key: SortKey): CurrencyMember[] {
  const arr = [...members];
  switch (key) {
    case "name":
      arr.sort((a, b) => a.userName.localeCompare(b.userName));
      break;
    case "daysRemaining":
      arr.sort((a, b) => {
        if (a.status === "never_used" && b.status !== "never_used") return 1;
        if (b.status === "never_used" && a.status !== "never_used") return -1;
        const da = a.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
        const db = b.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
      break;
    case "lastUsed":
      arr.sort((a, b) => {
        if (!a.lastUsageDate && !b.lastUsageDate) return a.userName.localeCompare(b.userName);
        if (!a.lastUsageDate) return 1;
        if (!b.lastUsageDate) return -1;
        return new Date(b.lastUsageDate).getTime() - new Date(a.lastUsageDate).getTime();
      });
      break;
    case "urgency":
    default:
      arr.sort((a, b) => {
        const rd = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (rd !== 0) return rd;
        const da = a.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
        const db = b.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return a.userName.localeCompare(b.userName);
      });
      break;
  }
  return arr;
}

function matchesFilter(member: CurrencyMember, filter: CurrencyFilter) {
  if (filter === "all") return true;
  if (filter === "at_risk") return member.status === "expired" || member.status === "warning";
  return member.status === filter;
}

export function BASkillsCurrencyTab({ onViewMemberHistory }: BASkillsCurrencyTabProps) {
  const data = useQuery(api.baCurrency.getBrigadeCurrency);

  const [filter, setFilter] = useState<CurrencyFilter>("all");
  const [memberFilter, setMemberFilter] = useState<Id<"users"> | null>(null);
  const [sort, setSort] = useState<SortKey>("urgency");
  const [groupOpen, setGroupOpen] = useState<Record<CurrencyStatus, boolean>>(DEFAULT_GROUP_OPEN);

  const allMembers: CurrencyMember[] = useMemo(
    () => data?.members ?? [],
    [data],
  );

  const memberOptions: MemberOption[] = useMemo(
    () => allMembers.map((m) => ({ _id: m.userId, name: m.userName })),
    [allMembers],
  );

  const filteredMembers = useMemo(() => {
    let m = allMembers;
    if (memberFilter) m = m.filter((x) => x.userId === memberFilter);
    if (filter !== "all") m = m.filter((x) => matchesFilter(x, filter));
    return m;
  }, [allMembers, memberFilter, filter]);

  const grouped = useMemo(() => {
    const map: Record<CurrencyStatus, CurrencyMember[]> = {
      expired: [],
      warning: [],
      never_used: [],
      current: [],
    };
    for (const m of filteredMembers) map[m.status].push(m);
    for (const k of STATUS_GROUP_ORDER) map[k] = sortMembers(map[k], sort);
    return map;
  }, [filteredMembers, sort]);

  // Any active filter or non-default sort → flat list instead of groups
  const useFlatList = sort !== "urgency" || filter !== "all" || !!memberFilter;
  const flatSorted = useMemo(
    () => (useFlatList ? sortMembers(filteredMembers, sort) : []),
    [useFlatList, filteredMembers, sort],
  );

  const toggleGroup = (status: CurrencyStatus) =>
    setGroupOpen((prev) => ({ ...prev, [status]: !prev[status] }));

  const handleExport = () => {
    if (allMembers.length === 0) return;
    downloadCsv(buildCurrencyCsv(sortMembers(allMembers, "urgency")), "ba-currency");
  };

  if (data === undefined) {
    return (
      <div data-component="BASkillsCurrencyTab">
        <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
          <div className="px-3 py-8 flex items-center justify-center">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (data.members.length === 0) {
    return (
      <div data-component="BASkillsCurrencyTab">
        <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
          <div className="px-3 py-3">
            <div className="rounded border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No members with BA skills found.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const noResults =
    (useFlatList && flatSorted.length === 0) ||
    (!useFlatList && filteredMembers.length === 0);

  return (
    <div data-component="BASkillsCurrencyTab">
      {/* Health hero */}
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <BACurrencyHealthBar
            counts={data.counts}
            activeFilter={filter}
            onFilterChange={setFilter}
          />
        </div>
      </div>

      {/* Members (toolbar + list) */}
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="px-3 py-3 sm:px-4 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <BACurrencyToolbar
            memberOptions={memberOptions}
            memberFilter={memberFilter}
            onMemberFilterChange={setMemberFilter}
            sort={sort}
            onSortChange={setSort}
            onExport={handleExport}
          />
        </div>
        <div className="px-2 py-2 sm:px-4 sm:py-4">
          {noResults ? (
            filter === "current" && !memberFilter ? (
              <div className="flex flex-col items-center gap-2 rounded border border-dashed border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-8 text-center">
                <PartyPopper className="h-6 w-6 text-green-500" />
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  Whole brigade is current, nice work.
                </p>
              </div>
            ) : (
              <div className="rounded border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {memberFilter
                  ? "That member doesn't match the current status filter."
                  : "No members in this status."}
              </div>
            )
          ) : useFlatList ? (
            <div className="space-y-2">
              {flatSorted.map((member) => (
                <BACurrencyRow
                  key={member.userId}
                  member={member}
                  onViewHistory={onViewMemberHistory}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {STATUS_GROUP_ORDER.map((status) => (
                <BACurrencyGroup
                  key={status}
                  status={status}
                  members={grouped[status]}
                  isOpen={groupOpen[status]}
                  onToggle={() => toggleGroup(status)}
                  onViewMember={onViewMemberHistory}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
