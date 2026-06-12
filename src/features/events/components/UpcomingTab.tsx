import { useMemo } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { enAU } from "date-fns/locale";
import { api } from "../../../../convex/_generated/api";
import { getTodayStr, parseEventDate } from "../types";
import { EventCard } from "./EventCard";
import { EmptyState } from "../../../components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";

export function UpcomingTab() {
  const events = useQuery(api.events.getUpcomingEvents, { fromDate: getTodayStr() });

  const isLoading = events === undefined;

  // Group by month for editorial section headers ("June 2026")
  const monthGroups = useMemo(() => {
    const groups: { label: string; events: NonNullable<typeof events> }[] = [];
    for (const event of events ?? []) {
      const label = format(parseEventDate(event.startDate), "MMMM yyyy", { locale: enAU });
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.events.push(event);
      } else {
        groups.push({ label, events: [event] });
      }
    }
    return groups;
  }, [events]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <EventListSkeleton />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
        <EmptyState
          icon={<CalendarDaysIcon className="h-10 w-10 text-red-400 dark:text-red-500" />}
          title="No upcoming events"
          description="When the brigade plans an event, it will show up here so you can RSVP."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {monthGroups.map(({ label, events: monthEvents }) => (
        <div key={label}>
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-2 pl-1">
            {label}
          </h3>
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
            {monthEvents.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventListSkeleton() {
  return (
    <div className="p-3 space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-14 w-[50px] rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
