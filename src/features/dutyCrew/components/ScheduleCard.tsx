import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Crown, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort, getUserFullName } from "../types";

interface ScheduleCardProps {
  assignment: {
    date: number;
    dutyCrew: {
      _id: Id<"dutyCrew">;
      name: string;
      number: number;
    };
    isSpecial: boolean;
    notes?: string;
  };
  isFirst?: boolean;
}

export function ScheduleCard({ assignment, isFirst }: ScheduleCardProps) {
  const members = useQuery(
    api.dutyCrewMembers.getDutyCrewMembers,
    assignment.isSpecial ? "skip" : { dutyCrewId: assignment.dutyCrew._id }
  );

  const leader = members?.find((m) => m.isLeader);

  return (
    <div
      className={cn(
        "rounded-lg border shadow-sm overflow-hidden transition-all hover:shadow-md",
        assignment.isSpecial
          ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
          : isFirst
            ? "border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 ring-2 ring-red-500/20 dark:ring-red-400/20"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      )}
    >
      {/* Date header */}
      <div
        className={cn(
          "px-3 py-2 border-b flex items-center gap-2",
          assignment.isSpecial
            ? "border-amber-200 dark:border-amber-800 bg-amber-100/50 dark:bg-amber-900/20"
            : isFirst
              ? "border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-950/20"
              : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80"
        )}
      >
        <Calendar
          className={cn(
            "h-3.5 w-3.5",
            assignment.isSpecial
              ? "text-amber-600 dark:text-amber-400"
              : isFirst
                ? "text-red-600 dark:text-red-400"
                : "text-gray-500 dark:text-gray-400"
          )}
        />
        <span
          className={cn(
            "text-xs font-semibold",
            assignment.isSpecial
              ? "text-amber-800 dark:text-amber-200"
              : isFirst
                ? "text-red-800 dark:text-red-200"
                : "text-gray-700 dark:text-gray-300"
          )}
        >
          {formatDateShort(assignment.date)}
        </span>
        {isFirst && !assignment.isSpecial && (
          <Badge
            variant="outline"
            className="ml-auto text-[10px] px-1.5 py-0 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
          >
            This Week
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          {assignment.isSpecial ? (
            <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          ) : (
            <Users className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          )}
          <h3
            className={cn(
              "text-sm font-bold",
              assignment.isSpecial
                ? "text-amber-900 dark:text-amber-200"
                : "text-gray-900 dark:text-white"
            )}
          >
            {assignment.dutyCrew.name}
          </h3>
        </div>

        {assignment.isSpecial && (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            All Crews
          </p>
        )}

        {assignment.notes && !assignment.isSpecial && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
            {assignment.notes}
          </p>
        )}

        {/* Leader & member count */}
        {assignment.isSpecial ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <Users className="h-3 w-3" />
            All duty crew members attend
          </p>
        ) : members ? (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {leader && (
              <span className="flex items-center gap-1">
                <Crown className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                {getUserFullName(leader)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <div className="mt-2 flex gap-2">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
