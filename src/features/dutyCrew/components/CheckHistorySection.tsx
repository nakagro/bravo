import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  CircleCheck,
  CircleX,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Tag,
} from "lucide-react";
import { formatDate, formatTime, getUserFullName } from "../types";

function completionBadgeClass(completed: number, total: number) {
  if (total === 0) return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
  const pct = completed / total;
  if (pct === 1) return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
  if (pct >= 0.7) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
}

export function CheckHistorySection() {
  const dutyCrews = useQuery(api.dutyCrew.getAllDutyCrews, {});
  const [selectedDutyCrew, setSelectedDutyCrew] = useState<Id<"dutyCrew"> | null>(null);
  const [expandedId, setExpandedId] = useState<Id<"stationCheckSubmissions"> | null>(null);

  // Auto-select first crew once data arrives
  useEffect(() => {
    if (dutyCrews && dutyCrews.length > 0 && !selectedDutyCrew) {
      setSelectedDutyCrew(dutyCrews[0]._id);
    }
  }, [dutyCrews, selectedDutyCrew]);

  const history = useQuery(
    api.stationChecks.getStationCheckHistory,
    selectedDutyCrew ? { dutyCrewId: selectedDutyCrew, limit: 20 } : "skip"
  );

  if (!dutyCrews) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Crew pill selector */}
      <div className="flex flex-wrap gap-2">
        {dutyCrews.map((crew) => (
          <button
            key={crew._id}
            onClick={() => {
              setSelectedDutyCrew(crew._id);
              setExpandedId(null);
            }}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              selectedDutyCrew === crew._id
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            )}
          >
            {crew.name}
          </button>
        ))}
      </div>

      {/* Results */}
      {!selectedDutyCrew ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-600 gap-2">
          <ClipboardCheck className="h-8 w-8" />
          <p className="text-sm">Select a duty crew to view check history</p>
        </div>
      ) : !history ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-600 gap-2">
          <ClipboardCheck className="h-8 w-8" />
          <p className="text-sm">No completed submissions found for this crew</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((submission) => {
            const completed = submission.checkItems.filter((i) => i.isCompleted).length;
            const total = submission.checkItems.length;
            const isExpanded = expandedId === submission._id;
            const templateItems = submission.checkItems.filter((i) => !i.isAdHoc);
            const adHocItems = submission.checkItems.filter((i) => i.isAdHoc);

            return (
              <div
                key={submission._id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Header row */}
                <button
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : submission._id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums flex-shrink-0 ${completionBadgeClass(completed, total)}`}
                    >
                      {completed}/{total}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {formatDate(submission.date)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {getUserFullName(submission.completedBy)} &middot;{" "}
                        {formatTime(submission.completedAt)}
                      </p>
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  }
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-3 bg-white dark:bg-gray-800">
                    {/* Template check items */}
                    {templateItems.length > 0 && (
                      <div className="space-y-1.5">
                        {templateItems.map((item, idx) => (
                          <div
                            key={`${item.checkId ?? idx}-${item.name}`}
                            className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800/60"
                          >
                            {item.isCompleted
                              ? <CircleCheck className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                              : <CircleX className="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            }
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 dark:text-gray-200">{item.name}</p>
                              {item.notes && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ad-hoc items */}
                    {adHocItems.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Tag className="h-3 w-3" /> Ad-hoc items
                        </p>
                        {adHocItems.map((item, idx) => (
                          <div
                            key={`adhoc-${idx}`}
                            className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40"
                          >
                            {item.isCompleted
                              ? <CircleCheck className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                              : <CircleX className="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            }
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 dark:text-gray-200">{item.name}</p>
                              {item.notes && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* General notes */}
                    {submission.notes && submission.notes.trim() && (
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          General notes
                        </p>
                        <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 rounded p-2">
                          {submission.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
