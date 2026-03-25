import { Check, MessageSquare, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserInitials, formatTime, type CheckItemData } from "../types";

interface StationCheckItemProps {
  item: CheckItemData;
  index: number;
  onToggle: () => void;
  onOpenNotes: () => void;
  onDelete?: () => void;
  completedByUser?: {
    firstName?: string;
    lastName?: string;
    name?: string;
  } | null;
}

export function StationCheckItem({
  item,
  index,
  onToggle,
  onOpenNotes,
  onDelete,
  completedByUser,
}: StationCheckItemProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border transition-all duration-200",
        item.isCompleted
          ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800 shadow-sm"
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
      )}
    >
      {/* Main tappable area */}
      <div
        className="flex items-center p-3 cursor-pointer select-none active:scale-[0.98] transition-transform duration-100"
        onClick={onToggle}
        role="checkbox"
        aria-checked={item.isCompleted}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        {/* Animated check circle */}
        <div className="flex-shrink-0 mr-3">
          <div
            className={cn(
              "relative w-8 h-8 rounded-full border-2 transition-all duration-300",
              item.isCompleted
                ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600 scale-110"
                : "border-gray-300 dark:border-gray-600 group-hover:border-green-400 dark:group-hover:border-green-500"
            )}
          >
            {item.isCompleted && (
              <Check className="absolute inset-0 w-5 h-5 text-white m-auto animate-in zoom-in-50 duration-200" />
            )}
            {!item.isCompleted && (
              <div className="absolute inset-2 rounded-full bg-gray-100 dark:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                "text-sm sm:text-base font-medium transition-colors duration-200",
                item.isCompleted
                  ? "text-green-800 dark:text-green-200"
                  : "text-gray-900 dark:text-white"
              )}
            >
              {item.name}
            </h3>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Ad-hoc badge */}
              {item.isAdHoc && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                  Ad-hoc
                </span>
              )}

              {/* Number badge */}
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium",
                  item.isCompleted
                    ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                )}
              >
                {index + 1}
              </div>
            </div>
          </div>

          {/* Notes preview */}
          {item.notes && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
              {item.notes}
            </p>
          )}

          {/* Per-item attribution */}
          {item.isCompleted && completedByUser && item.completedAt && (
            <div className="mt-1 flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-200 dark:bg-green-800 text-[8px] font-bold text-green-800 dark:text-green-200">
                {getUserInitials(completedByUser)}
              </span>
              <span className="text-[10px] text-green-700 dark:text-green-400">
                {formatTime(item.completedAt)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 px-3 py-2 flex justify-between items-center">
        <div>
          {item.isAdHoc && onDelete && (
            <button
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          )}
        </div>
        <button
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            onOpenNotes();
          }}
        >
          {item.notes ? (
            <>
              <MessageSquare className="h-3.5 w-3.5" />
              Edit Notes
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Add Notes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
