import { Check, MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserInitials, formatTime, type CheckItemData } from "../types";

interface StationCheckItemProps {
  item: CheckItemData;
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
      <div
        className="flex items-center gap-3 py-2 pl-3 pr-1 cursor-pointer select-none active:scale-[0.98] transition-transform duration-100"
        onClick={onToggle}
        role="checkbox"
        aria-checked={item.isCompleted}
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        {/* Animated check circle */}
        <div className="flex-shrink-0">
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
          <div className="flex items-center gap-1.5">
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
            {item.isAdHoc && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded flex-shrink-0">
                Ad-hoc
              </span>
            )}
          </div>

          {/* Notes preview */}
          {item.notes && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
              {item.notes}
            </p>
          )}

          {/* Per-item attribution */}
          {item.isCompleted && completedByUser && item.completedAt && (
            <div className="mt-0.5 flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-200 dark:bg-green-800 text-[8px] font-bold text-green-800 dark:text-green-200">
                {getUserInitials(completedByUser)}
              </span>
              <span className="text-[10px] text-green-700 dark:text-green-400">
                {formatTime(item.completedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Inline actions */}
        <div className="flex items-center flex-shrink-0">
          {item.isAdHoc && onDelete && (
            <button
              aria-label={`Remove ${item.name}`}
              className="flex items-center justify-center h-10 w-10 rounded-full text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            aria-label={item.notes ? `Edit notes for ${item.name}` : `Add notes for ${item.name}`}
            className={cn(
              "flex items-center justify-center h-10 w-10 rounded-full transition-colors active:scale-95",
              item.notes
                ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onOpenNotes();
            }}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
