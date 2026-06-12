import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortKey } from "../lib/types";
import { MemberCombobox, MemberOption } from "./MemberCombobox";
import { Id } from "../../../../convex/_generated/dataModel";

interface BACurrencyToolbarProps {
  memberOptions: MemberOption[];
  memberFilter: Id<"users"> | null;
  onMemberFilterChange: (id: Id<"users"> | null) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  onExport?: () => void;
}

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "urgency", label: "Most urgent first" },
  { value: "name", label: "Name (A→Z)" },
  { value: "daysRemaining", label: "Days remaining" },
  { value: "lastUsed", label: "Last used" },
];

export function BACurrencyToolbar({
  memberOptions,
  memberFilter,
  onMemberFilterChange,
  sort,
  onSortChange,
  onExport,
}: BACurrencyToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
      <div className="flex-1">
        <MemberCombobox
          label="Filter by member"
          options={memberOptions}
          value={memberFilter}
          onChange={onMemberFilterChange}
          placeholder="Search for a member"
          emptyText="No members found."
        />
      </div>
      <div className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1 sm:w-56 sm:flex-none">
          <label className="text-sm font-medium text-foreground">Sort</label>
          <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {onExport && (
          <Button variant="outline" onClick={onExport} className="shrink-0">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        )}
      </div>
    </div>
  );
}
