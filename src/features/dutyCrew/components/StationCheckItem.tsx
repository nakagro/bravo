import { forwardRef, type ReactNode } from "react";
import { Check, CircleSlash, ClipboardList, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ChecklistRow } from "@/components/shared/checklist";
import {
  checkItemStatus,
  getUserInitials,
  formatDayTime,
  type CheckItemData,
  type LinkedInventoryInfo,
} from "../types";

interface StationCheckItemProps {
  item: CheckItemData;
  /** Present when this row is ticked off by the Inventory module instead. */
  linked?: LinkedInventoryInfo;
  /** Whether the viewer can reach /inventory. The row still renders without it. */
  canOpenInventory?: boolean;
  onToggle: () => void;
  onOpenNotes: () => void;
  onDelete?: () => void;
  assignment?: ReactNode;
  completedByUser?: {
    firstName?: string;
    lastName?: string;
    name?: string;
  } | null;
}

export const StationCheckItem = forwardRef<HTMLDivElement, StationCheckItemProps>(
  function StationCheckItem(
    {
      item,
      linked,
      canOpenInventory = false,
      onToggle,
      onOpenNotes,
      onDelete,
      assignment,
      completedByUser,
    },
    ref,
  ) {
    const navigate = useNavigate();
    const status = checkItemStatus(item);
    const isNA = status === "attention";

    return (
      <ChecklistRow
        ref={ref}
        status={status}
        name={item.name}
        notes={item.notes}
        emphasis={item.isPriority ? "priority" : undefined}
        onActivate={onToggle}
        onOpenNotes={onOpenNotes}
        notesLabel={
          item.notes ? `Edit notes for ${item.name}` : `Add notes for ${item.name}`
        }
        leading={
          <div
            className={cn(
              "relative w-8 h-8 rounded-full border-2 transition-all duration-300",
              status === "resolved"
                ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600 scale-110"
                : isNA
                  ? "bg-amber-100 dark:bg-amber-900/40 border-amber-400 dark:border-amber-600"
                  : "border-gray-300 dark:border-gray-600 group-hover:border-green-400 dark:group-hover:border-green-500",
            )}
          >
            {status === "resolved" && (
              <Check className="absolute inset-0 w-5 h-5 text-white m-auto animate-in zoom-in-50 duration-200" />
            )}
            {isNA && (
              <CircleSlash className="absolute inset-0 w-5 h-5 text-amber-600 dark:text-amber-400 m-auto animate-in zoom-in-50 duration-200" />
            )}
            {status === "unanswered" && (
              <div className="absolute inset-2 rounded-full bg-gray-100 dark:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}
          </div>
        }
        badges={
          <>
            {item.isPriority && status === "unanswered" && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded flex-shrink-0 uppercase tracking-wide">
                Priority
              </span>
            )}
            {isNA && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded flex-shrink-0">
                N/A
              </span>
            )}
            {item.isAdHoc && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded flex-shrink-0">
                Ad-hoc
              </span>
            )}
            {linked && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded flex-shrink-0">
                Inventory
              </span>
            )}
          </>
        }
        meta={
          // A linked row's attribution belongs to the inventory run, and reads
          // differently: the point is that the tick came from another module.
          linked ? (
            linked.completedAt ? (
              <span className="text-[10px] text-blue-700 dark:text-blue-400">
                via Inventory
                {linked.completedByName ? ` - ${linked.completedByName}` : ""}
                {` - ${formatDayTime(linked.completedAt)}`}
              </span>
            ) : (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {linked.inProgressRunId
                  ? "Inventory check in progress"
                  : "Done in the Inventory module"}
              </span>
            )
          ) : status !== "unanswered" && completedByUser && item.completedAt ? (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold",
                  isNA
                    ? "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200"
                    : "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200",
                )}
              >
                {getUserInitials(completedByUser)}
              </span>
              <span
                className={cn(
                  "text-[10px]",
                  isNA
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-green-700 dark:text-green-400",
                )}
              >
                {formatDayTime(item.completedAt)}
              </span>
            </div>
          ) : null
        }
        trailing={
          <>
            {assignment}
            {linked && canOpenInventory ? (
              <button
                aria-label={`Open ${linked.templateName} in Inventory`}
                className="flex items-center justify-center h-11 w-11 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors active:scale-95"
                onClick={() => navigate(`/inventory?template=${linked.templateId}`)}
              >
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            {item.isAdHoc && onDelete ? (
              <button
                aria-label={`Remove ${item.name}`}
                className="flex items-center justify-center h-11 w-11 rounded-full text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </>
        }
      />
    );
  },
);
