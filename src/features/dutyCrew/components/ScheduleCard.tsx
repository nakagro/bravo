import { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Crown, TriangleAlert, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort, getUserFullName } from "../types";

export interface ScheduleAssignment {
  date: number;
  dutyCrew: {
    _id: Id<"dutyCrew">;
    name: string;
    number: number;
  };
  isSpecial: boolean;
  notes?: string;
  scheduleId?: Id<"dutyCrewSchedule">;
  members: Array<{
    _id: Id<"users">;
    name: string;
    firstName?: string;
    lastName?: string;
    isLeader: boolean;
  }>;
}

interface ScheduleCardProps {
  assignment: ScheduleAssignment;
  isFirst?: boolean;
  onEdit?: () => void;
  currentUserId?: Id<"users"> | null;
}

const isUsersCrew = (
  assignment: ScheduleAssignment,
  currentUserId?: Id<"users"> | null
) =>
  !assignment.isSpecial &&
  !!currentUserId &&
  assignment.members.some((m) => m._id === currentUserId);

function YourCrewBadge() {
  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1.5 py-0 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 flex-shrink-0"
    >
      Your crew
    </Badge>
  );
}

export function ScheduleCard({
  assignment,
  isFirst,
  onEdit,
  currentUserId,
}: ScheduleCardProps) {
  const leader = assignment.members.find((m) => m.isLeader);
  const isEdited = assignment.scheduleId !== undefined;
  const isYourCrew = isUsersCrew(assignment, currentUserId);

  return (
    <div
      className={cn(
        "rounded-lg border shadow-sm overflow-hidden transition-all hover:shadow-md",
        assignment.isSpecial
          ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
          : isFirst
            ? "border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 ring-2 ring-blue-500/20 dark:ring-blue-400/20"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      )}
    >
      {/* Date header */}
      <div
        className={cn(
          "px-3 border-b flex items-center gap-2",
          onEdit ? "py-0.5 min-h-[40px]" : "py-2",
          assignment.isSpecial
            ? "border-amber-200 dark:border-amber-800 bg-amber-100/50 dark:bg-amber-900/20"
            : isFirst
              ? "border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20"
              : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80"
        )}
      >
        <Calendar
          className={cn(
            "h-3.5 w-3.5",
            assignment.isSpecial
              ? "text-amber-600 dark:text-amber-400"
              : isFirst
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400"
          )}
        />
        <span
          className={cn(
            "text-xs font-semibold",
            assignment.isSpecial
              ? "text-amber-800 dark:text-amber-200"
              : isFirst
                ? "text-blue-800 dark:text-blue-200"
                : "text-gray-700 dark:text-gray-300"
          )}
        >
          {formatDateShort(assignment.date)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {isEdited && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
            >
              Edited
            </Badge>
          )}
          {isFirst && !assignment.isSpecial && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
            >
              This Week
            </Badge>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              aria-label={`Edit schedule for ${formatDateShort(assignment.date)}`}
              className="flex items-center justify-center h-10 w-10 -mr-2 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          {assignment.isSpecial && (
            <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
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
          {isYourCrew && <YourCrewBadge />}
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
        ) : (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {leader && (
              <span className="flex items-center gap-1">
                <Crown className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                {getUserFullName(leader)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {assignment.members.length} member
              {assignment.members.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ScheduleRowProps {
  assignment: ScheduleAssignment;
  onEdit?: () => void;
  currentUserId?: Id<"users"> | null;
}

// Compact single-row rendering for future Sundays (the current week gets the
// full ScheduleCard treatment).
export function ScheduleRow({ assignment, onEdit, currentUserId }: ScheduleRowProps) {
  const leader = assignment.members.find((m) => m.isLeader);
  const isEdited = assignment.scheduleId !== undefined;
  const isYourCrew = isUsersCrew(assignment, currentUserId);

  return (
    <div
      className={cn(
        "flex items-center gap-3 pl-3",
        onEdit ? "py-1 pr-1" : "py-2.5 pr-3",
        assignment.isSpecial && "bg-amber-50 dark:bg-amber-950/30"
      )}
    >
      <span
        className={cn(
          "w-[4.5rem] flex-shrink-0 text-xs font-semibold",
          assignment.isSpecial
            ? "text-amber-800 dark:text-amber-200"
            : "text-gray-700 dark:text-gray-300"
        )}
      >
        {formatDateShort(assignment.date)}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {assignment.isSpecial && (
            <TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          )}
          <span
            className={cn(
              "text-sm font-semibold truncate",
              assignment.isSpecial
                ? "text-amber-900 dark:text-amber-200"
                : "text-gray-900 dark:text-white"
            )}
          >
            {assignment.dutyCrew.name}
          </span>
          {isYourCrew && <YourCrewBadge />}
          {isEdited && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex-shrink-0"
            >
              Edited
            </Badge>
          )}
        </div>
        <div
          className={cn(
            "flex items-center gap-3 text-xs",
            assignment.isSpecial
              ? "text-amber-700 dark:text-amber-300"
              : "text-gray-500 dark:text-gray-400"
          )}
        >
          {assignment.isSpecial ? (
            <span>All duty crew members attend</span>
          ) : (
            <>
              {leader && (
                <span className="flex items-center gap-1 truncate">
                  <Crown className="h-3 w-3 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                  {getUserFullName(leader)}
                </span>
              )}
              <span className="flex items-center gap-1 flex-shrink-0">
                <Users className="h-3 w-3" />
                {assignment.members.length}
              </span>
            </>
          )}
        </div>
      </div>

      {onEdit && (
        <button
          onClick={onEdit}
          aria-label={`Edit schedule for ${formatDateShort(assignment.date)}`}
          className="flex items-center justify-center h-10 w-10 flex-shrink-0 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
