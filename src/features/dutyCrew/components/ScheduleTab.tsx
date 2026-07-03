import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Users } from "lucide-react";
import { ScheduleCard, ScheduleRow } from "./ScheduleCard";
import {
  ScheduleOverridePanel,
  type OverrideAssignment,
} from "./ScheduleOverridePanel";

interface ScheduleTabProps {
  isAdmin: boolean;
}

export function ScheduleTab({ isAdmin }: ScheduleTabProps) {
  const upcomingAssignments = useQuery(
    api.dutyCrew.getUpcomingDutyCrewAssignments,
    { count: 8 }
  );
  const [editingAssignment, setEditingAssignment] =
    useState<OverrideAssignment | null>(null);

  if (!upcomingAssignments) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (upcomingAssignments.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <Users className="h-10 w-10 mx-auto mb-3 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
          No upcoming schedule
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Set up your first duty crew in the Admin tab to get started.
        </p>
      </div>
    );
  }

  const [thisWeek, ...futureWeeks] = upcomingAssignments;

  const editHandler = (assignment: (typeof upcomingAssignments)[number]) =>
    isAdmin
      ? () =>
          setEditingAssignment({
            date: assignment.date,
            dutyCrewId: assignment.dutyCrew._id,
            isSpecial: assignment.isSpecial,
            notes: assignment.notes,
            scheduleId: assignment.scheduleId,
          })
      : undefined;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Upcoming Schedule
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Next {upcomingAssignments.length} Sundays
        </span>
      </div>

      <ScheduleCard
        assignment={thisWeek}
        isFirst
        onEdit={editHandler(thisWeek)}
      />

      {futureWeeks.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
          {futureWeeks.map((assignment) => (
            <ScheduleRow
              key={assignment.date}
              assignment={assignment}
              onEdit={editHandler(assignment)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <ScheduleOverridePanel
          assignment={editingAssignment}
          onClose={() => setEditingAssignment(null)}
        />
      )}
    </div>
  );
}
