import { ChevronDown } from "lucide-react";
import { CurrencyStatus, STATUS_META } from "../lib/currency";
import { CurrencyMember } from "../lib/types";
import { BACurrencyRow } from "./BACurrencyRow";
import { Id } from "../../../../convex/_generated/dataModel";

interface BACurrencyGroupProps {
  status: CurrencyStatus;
  members: CurrencyMember[];
  isOpen: boolean;
  onToggle: () => void;
  onViewMember?: (userId: Id<"users">) => void;
}

export function BACurrencyGroup({
  status,
  members,
  isOpen,
  onToggle,
  onViewMember,
}: BACurrencyGroupProps) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  if (members.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={isOpen}
      >
        <Icon className={`h-4 w-4 ${meta.textClass}`} />
        <span className="font-medium text-sm text-foreground">{meta.label}</span>
        <span className="text-sm text-muted-foreground">({members.length})</span>
        <ChevronDown
          className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="p-2 space-y-1.5 bg-white dark:bg-gray-800">
          {members.map((member) => (
            <BACurrencyRow
              key={member.userId}
              member={member}
              onViewHistory={onViewMember}
            />
          ))}
        </div>
      )}
    </div>
  );
}
