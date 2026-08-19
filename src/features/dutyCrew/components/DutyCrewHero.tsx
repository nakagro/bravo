import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Crown,
  TriangleAlert,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  statusConfig,
  formatDate,
  getUserFullName,
  getUserInitials,
  type SubmissionStatus,
} from "../types";

interface DutyCrewHeroProps {
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  currentSunday: Date;
  assignment: {
    date: number;
    dutyCrew: {
      _id: Id<"dutyCrew">;
      name: string;
      number: number;
    };
    isSpecial: boolean;
    notes?: string;
  } | null;
  /** Crew roster to name; undefined while it loads. */
  members?: Array<{
    _id: Id<"users">;
    name?: string;
    firstName?: string;
    lastName?: string;
    isLeader: boolean;
  }>;
  /** True when `members` is a snapshot of the week rather than today's crew. */
  isHistoricalRoster?: boolean;
  submissionStatus: SubmissionStatus | "not_started";
  onReopen?: () => void;
  canReopen: boolean;
}

export function DutyCrewHero({
  weekOffset,
  onWeekChange,
  currentSunday,
  assignment,
  members,
  isHistoricalRoster = false,
  submissionStatus,
  onReopen,
  canReopen,
}: DutyCrewHeroProps) {
  const [expandedMemberIds, setExpandedMemberIds] = useState<Set<string>>(
    new Set()
  );
  const toggleMemberName = (id: string) =>
    setExpandedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const status = statusConfig[submissionStatus];
  const isSpecial = assignment?.isSpecial ?? false;

  return (
    <div
      className={cn(
        "rounded-xl border shadow-sm overflow-hidden",
        isSpecial
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      )}
    >
      {/* Week navigation header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 border-b",
          isSpecial
            ? "border-amber-200 dark:border-amber-800 bg-amber-100/50 dark:bg-amber-900/20"
            : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label="Previous week"
          onClick={() => onWeekChange(weekOffset - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex flex-col items-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Week ending
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatDate(currentSunday.getTime())}
          </span>
          {weekOffset !== 0 && (
            <button
              onClick={() => onWeekChange(0)}
              className="min-h-[44px] px-2 -mb-1.5 flex items-center text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Return to current week
            </button>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          aria-label="Next week"
          onClick={() => onWeekChange(weekOffset + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Main hero content */}
      <div className="p-4">
        {!assignment ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No duty crew assigned for this week</p>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            {/* Crew info - progress lives in the sticky ChecklistProgressHeader
                below, so the ring isn't duplicated here */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className={cn(
                    "text-lg font-bold",
                    isSpecial
                      ? "text-amber-900 dark:text-amber-200"
                      : "text-gray-900 dark:text-white"
                  )}
                >
                  {assignment.dutyCrew.name}
                </h2>
                <Badge
                  variant="outline"
                  className={cn(status.bg, status.text, status.border)}
                >
                  {status.label}
                </Badge>
                {canReopen && submissionStatus === "completed" && onReopen && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 px-3 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={onReopen}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reopen
                  </Button>
                )}
              </div>

              {isSpecial && (
                <div className="flex items-center gap-1 mt-1">
                  <TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    All Crews
                  </span>
                </div>
              )}

              {/* Members */}
              {isSpecial ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <Users className="h-3.5 w-3.5" />
                  <span>All duty crew members attend</span>
                </div>
              ) : members && members.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {members.map((member) => (
                    <button
                      key={member._id}
                      onClick={() => toggleMemberName(member._id)}
                      aria-expanded={expandedMemberIds.has(member._id)}
                      aria-label={
                        expandedMemberIds.has(member._id)
                          ? `Hide name for ${getUserFullName(member)}`
                          : `Show name for ${getUserFullName(member)}`
                      }
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors",
                        member.isLeader
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      )}
                    >
                      {member.isLeader && (
                        <Crown className="h-3 w-3 flex-shrink-0" />
                      )}
                      <span className="font-medium">
                        {getUserInitials(member)}
                      </span>
                      <span
                        className={
                          expandedMemberIds.has(member._id)
                            ? "inline"
                            : "hidden sm:inline"
                        }
                      >
                        {getUserFullName(member)}
                      </span>
                    </button>
                  ))}
                  {isHistoricalRoster && (
                    <span className="w-full mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                      Crew as at this week
                    </span>
                  )}
                </div>
              ) : !isSpecial && !members ? (
                <div className="mt-3 flex gap-1.5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
