import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { getTodayStr } from "../types";
import { EventCard } from "./EventCard";
import { EventListSkeleton } from "./UpcomingTab";
import { EmptyState } from "../../../components/shared/EmptyState";
import { ArchiveBoxIcon } from "@heroicons/react/24/outline";

export function PastTab() {
  const events = useQuery(api.events.getPastEvents, { beforeDate: getTodayStr() });

  const isLoading = events === undefined;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Past Events
        </h3>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {isLoading ? (
          <EventListSkeleton />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<ArchiveBoxIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
            title="No past events"
            description="Past events stay here as an attendance record."
          />
        ) : (
          events.map((event) => <EventCard key={event._id} event={event} readOnly />)
        )}
      </div>
    </div>
  );
}
