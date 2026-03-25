import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { statusConfig, priorityConfig, fieldNameMap } from "../types";

interface VehicleFaultHistoryProps {
  faultId: Id<"vehicleFaults">;
}

export function VehicleFaultHistory({ faultId }: VehicleFaultHistoryProps) {
  const history = useQuery(api.vehicleFaults.getFaultHistory, { faultId });

  if (history === undefined) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-700 dark:border-red-500" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 italic">
        No changes recorded
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {history.slice(0, 15).map((entry) => (
        <HistoryEntry key={entry._id} entry={entry} />
      ))}
      {history.length > 15 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Showing 15 of {history.length} changes
        </p>
      )}
    </div>
  );
}

function formatFieldValue(field: string, value: any): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (field === "status") return statusConfig[value as keyof typeof statusConfig]?.label ?? value;
  if (field === "priority") return priorityConfig[value as keyof typeof priorityConfig]?.label ?? value;
  if (typeof value === "number" && value > 1000000000000) {
    return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "2-digit" });
  }
  return String(value);
}

function HistoryEntry({ entry }: { entry: any }) {
  const timeAgo = formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true });

  if (entry.changeType === "fault_created") {
    return (
      <div className="text-xs py-1.5 px-2 rounded bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/30">
        <span className="text-green-700 dark:text-green-400 font-medium">Created</span>
        <span className="text-gray-500 dark:text-gray-400 ml-2">
          {timeAgo} by {entry.userName ?? "Unknown"}
        </span>
      </div>
    );
  }

  if (entry.changeType === "fault_deleted") {
    return (
      <div className="text-xs py-1.5 px-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30">
        <span className="text-red-700 dark:text-red-400 font-medium">Deleted</span>
        <span className="text-gray-500 dark:text-gray-400 ml-2">
          {timeAgo} by {entry.userName ?? "Unknown"}
        </span>
      </div>
    );
  }

  const fieldLabel = fieldNameMap[entry.field] || entry.field;

  return (
    <div className="text-xs py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
      <div className="flex items-baseline gap-1 flex-wrap">
        <span className="font-medium text-gray-700 dark:text-gray-300">{fieldLabel}</span>
        <span className="text-gray-400">changed</span>
        <span className="text-gray-500 dark:text-gray-400">{timeAgo}</span>
        <span className="text-gray-400">by {entry.userName ?? "Unknown"}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="text-red-600 dark:text-red-400 line-through">
          {formatFieldValue(entry.field, entry.oldValue)}
        </span>
        <span className="text-gray-400">&rarr;</span>
        <span className="text-green-600 dark:text-green-400">
          {formatFieldValue(entry.field, entry.newValue)}
        </span>
      </div>
    </div>
  );
}
