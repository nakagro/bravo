import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ProgressRing } from "@/components/common/ProgressRing";
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
  type CheckItemData,
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
  checkItems: CheckItemData[];
  submissionStatus: SubmissionStatus | "not_started";
  onReopen?: () => void;
  canReopen: boolean;
}

export function DutyCrewHero({
  weekOffset,
  onWeekChange,
  currentSunday,
  assignment,
  checkItems,
  submissionStatus,
  onReopen,
  canReopen,
}: DutyCrewHeroProps) {
  const dutyCrewMembers = useQuery(
    api.dutyCrewMembers.getDutyCrewMembers,
    assignment && !assignment.isSpecial ? { dutyCrewId: assignment.dutyCrew._id } : "skip"
  );

  const completedCount = checkItems.filter((item) => item.isCompleted).length;
  const totalCount = checkItems.length;
  const percentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const status = statusConfig[submissionStatus];
  const isSpecial = assignment?.isSpecial ?? false;

  const ringColor =
    submissionStatus === "completed"
      ? "stroke-green-500 dark:stroke-green-400"
      : submissionStatus === "draft"
        ? "stroke-yellow-500 dark:stroke-yellow-400"
        : "stroke-gray-400 dark:stroke-gray-500";

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
          className="h-8 w-8"
          onClick={() => onWeekChange(weekOffset - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatDate(currentSunday.getTime())}
          </span>
          {weekOffset !== 0 && (
            <button
              onClick={() => onWeekChange(0)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Return to current week
            </button>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
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
            {/* Progress ring */}
            <div className="flex-shrink-0">
              <ProgressRing
                percentage={percentage}
                size={64}
                strokeWidth={5}
                color={ringColor}
                showLabel
                label={`${completedCount}/${totalCount}`}
                labelClass="text-xs font-bold"
              />
            </div>

            {/* Crew info */}
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
                    className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
              ) : dutyCrewMembers && dutyCrewMembers.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {dutyCrewMembers.map((member) => (
                    <div
                      key={member._id}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
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
                      <span className="hidden sm:inline">
                        {getUserFullName(member)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : !isSpecial && !dutyCrewMembers ? (
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
