import { useState } from "react";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { formatCompactAgo, formatUserName, rsvpStatusLabels, RsvpStatus } from "../types";

interface ResponseActivityProps {
  eventId: Id<"events">;
}

const statusLabel = (value: unknown): string => {
  if (typeof value === "string" && value in rsvpStatusLabels) {
    return rsvpStatusLabels[value as RsvpStatus];
  }
  return "No response";
};

/**
 * What each member did to their own answer, newest first.
 *
 * The counts tell an organiser where the event stands; this tells them how it
 * got there - the yes that became a no the night before, the shift picked up
 * and quietly dropped. Collapsed by default: it's for the moment you go looking,
 * not something to read every visit.
 */
export function ResponseActivity({ eventId }: ResponseActivityProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Only fetched once opened - most visits never need it.
  const activity = useQuery(api.events.getResponseActivity, isOpen ? { eventId } : "skip");

  const describe = (entry: { field: string; oldValue: unknown; newValue: unknown }): string => {
    if (entry.field === "shift") {
      return entry.newValue
        ? `picked up ${String(entry.newValue)}`
        : `dropped ${entry.oldValue ? String(entry.oldValue) : "a shift"}`;
    }
    if (entry.field === "guests") {
      const from = Number(entry.oldValue ?? 0);
      const to = Number(entry.newValue ?? 0);
      if (to === 0) return "is no longer bringing guests";
      return from === 0
        ? `is bringing ${to} ${to === 1 ? "guest" : "guests"}`
        : `changed guests from ${from} to ${to}`;
    }
    // An rsvp entry with no previous value is a first answer, not a change
    return entry.oldValue
      ? `changed ${statusLabel(entry.oldValue)} to ${statusLabel(entry.newValue)}`
      : `answered ${statusLabel(entry.newValue)}`;
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-2 text-left group min-h-[32px]"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
          Response activity
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 ml-auto transition-transform group-hover:text-gray-600 dark:group-hover:text-gray-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-2">
          {activity === undefined ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>
          ) : !activity || activity.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No changes recorded yet. Only changes made from now on appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {activity.map((entry) => (
                <li
                  key={entry._id}
                  className="flex items-baseline gap-2 text-sm text-gray-700 dark:text-gray-300"
                  title={formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                >
                  <span className="min-w-0">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {entry.member ? formatUserName(entry.member) : "A former member"}
                    </span>{" "}
                    {describe(entry)}
                  </span>
                  {/* Same shape as the response rows above: the time is a short
                      token on the right, not a line of its own. */}
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatCompactAgo(entry.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
