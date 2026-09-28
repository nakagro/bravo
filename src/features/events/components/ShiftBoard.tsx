import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { compareUserNames, formatSlotWhen, slotCoverageLabel, formatUserName } from "../types";
import { NameColumns, NameSentence } from "./NameColumns";

interface ShiftBoardProps {
  eventId: Id<"events">;
  /** Team leaders for the event - tagged wherever they appear on the board */
  leaderIds?: Id<"users">[];
}

/**
 * Zone 3 read-only turnout board for a shift event - the communal noticeboard.
 *
 * Purely display: no toggles, no input (the caller expresses interest in the
 * SlotPicker card above).
 *
 * Each shift reads top to bottom as the organiser thinks about it:
 *  - who's on: the rostered people, in columns - the answer to "who's on";
 *  - the gap: anyone rostered who has since said they can't make it, pulled out
 *    of the list onto one amber line rather than struck through inside it;
 *  - the bench: everyone else who put their hand up, as one muted sentence.
 * Before anyone is rostered, interest is the whole picture, so it gets the
 * columns instead. Nobody who offered ever disappears.
 */
export function ShiftBoard({ eventId, leaderIds = [] }: ShiftBoardProps) {
  const slots = useQuery(api.events.getEventSlots, { eventId });
  // Marks "you" in the lists - the one thing you can't work out by looking,
  // since offers get spread across shifts by the organiser
  const myUserId = useQuery(api.messages.getCurrentUserId) ?? null;

  if (slots === undefined) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No shifts have been set up for this event yet.
      </p>
    );
  }

  const anyone = slots.some((slot) => slot.allocated.length > 0 || slot.interested.length > 0);
  if (!anyone) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Nobody&apos;s put their hand up yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {slots.map((slot) => {
        const when = formatSlotWhen(slot);
        const onRoster = slot.allocated.filter((m) => !m.declined);
        const cantMakeIt = slot.allocated.filter((m) => m.declined).sort(compareUserNames);
        // The bench: interested but not on the roster. Dedupe against the roster
        // so someone interested who then got allocated only shows once (rostered).
        const rosteredIds = new Set(slot.allocated.map((m) => m._id));
        const interested = slot.interested.filter((m) => !rosteredIds.has(m._id));
        const underfilled = !!slot.targetCount && slot.allocatedCount < slot.targetCount;
        const hasRoster = slot.allocated.length > 0;

        const summary = [
          hasRoster ? `${slotCoverageLabel(slot.allocatedCount, slot.targetCount)} rostered` : null,
          interested.length > 0
            ? `${interested.length} ${hasRoster ? "also interested" : "interested"}`
            : null,
        ].filter(Boolean);

        return (
          <div key={slot._id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {slot.label}
              </span>
              {when && (
                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{when}</span>
              )}
            </div>
            <p
              className={`text-xs ${
                underfilled
                  ? "font-medium text-amber-700 dark:text-amber-400"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {summary.length > 0 ? summary.join(" · ") : "Nobody yet"}
            </p>

            {onRoster.length > 0 && (
              <div className="mt-2">
                <NameColumns members={onRoster} myUserId={myUserId} leaderIds={leaderIds} />
              </div>
            )}

            {cantMakeIt.length > 0 && (
              <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                Can&apos;t make it: {cantMakeIt.map(formatUserName).join(", ")}
              </p>
            )}

            {interested.length > 0 &&
              (hasRoster ? (
                <NameSentence
                  label="Also interested"
                  members={interested}
                  myUserId={myUserId}
                  leaderIds={leaderIds}
                  className="mt-2 text-gray-500 dark:text-gray-400"
                />
              ) : (
                <div className="mt-2">
                  <NameColumns members={interested} myUserId={myUserId} leaderIds={leaderIds} />
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}
