import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Users } from "lucide-react";
import { ScheduleCard } from "./ScheduleCard";

export function ScheduleTab() {
  const upcomingAssignments = useQuery(
    api.dutyCrew.getUpcomingDutyCrewAssignments,
    { count: 8 }
  );

  if (!upcomingAssignments) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          />
        ))}
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Upcoming Schedule
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Next {upcomingAssignments.length} Sundays
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {upcomingAssignments.map((assignment, index) => (
          <ScheduleCard
            key={assignment.date}
            assignment={assignment}
            isFirst={index === 0}
          />
        ))}
      </div>
    </div>
  );
}
