import { useState } from "react";
import { useQuery } from "convex/react";
import { Pencil } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { compareUserNames, formatSlotWhen, slotCoverageLabel, formatUserName } from "../types";
import { NameColumns, NameSentence } from "./NameColumns";
import { shortApplianceName } from "./badges";
import { shiftCrewSummary } from "./shiftCrews";
import { ShiftCrewDialog, type ShiftCrewTarget } from "./ShiftCrewDialog";
import { emptySeats, toSeatsDraft } from "@/components/shared/crew/crewSeats";

interface ShiftBoardProps {
  eventId: Id<"events">;
  /** Team leaders for the event - tagged wherever they appear on the board */
  leaderIds?: Id<"users">[];
  /** Manager of an open event: per-shift crews get an edit button */
  canEditCrews?: boolean;
}

/** Interest-only lists past this many names fold behind "Show all". */
const INTEREST_PREVIEW = 6;

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
export function ShiftBoard({ eventId, leaderIds = [], canEditCrews = false }: ShiftBoardProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingCrew, setEditingCrew] = useState<ShiftCrewTarget | null>(null);
  const slots = useQuery(api.events.getEventSlots, { eventId });
  // Marks "you" in the lists - the one thing you can't work out by looking,
  // since offers get spread across shifts by the organiser
  const myUserId = useQuery(api.messages.getCurrentUserId) ?? null;
  // Appliances crewed per shift show their crew inside each shift, where
  // members already look for "when am I on"
  const crews = useQuery(api.eventCrews.listEventCrews, { eventId });
  const perShiftCrews = (crews ?? []).filter((crew) => crew.perShift);
  const shiftCrews = useQuery(
    api.eventCrews.listShiftCrews,
    perShiftCrews.length > 0 ? { eventId } : "skip"
  );

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

  const anyone =
    slots.some((slot) => slot.allocated.length > 0 || slot.interested.length > 0) ||
    (shiftCrews?.length ?? 0) > 0;
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
                // Before anyone's rostered, interest is the picture - but a
                // long list of it swamps a phone, so it folds after a few.
                <div className="mt-2">
                  <NameColumns
                    members={
                      expanded.has(slot._id)
                        ? interested
                        : previewMembers(interested, myUserId, INTEREST_PREVIEW)
                    }
                    myUserId={myUserId}
                    leaderIds={leaderIds}
                  />
                  {interested.length > INTEREST_PREVIEW && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(slot._id)) next.delete(slot._id);
                          else next.add(slot._id);
                          return next;
                        })
                      }
                      className="mt-1 min-h-[44px] text-sm font-medium text-red-700 hover:underline dark:text-red-400"
                    >
                      {expanded.has(slot._id)
                        ? "Show fewer"
                        : `Show all ${interested.length}`}
                    </button>
                  )}
                </div>
              ))}

            {/* Per-shift appliance crews close the shift: who's on, then the truck */}
            {perShiftCrews.map((crew) => {
              const row = shiftCrews?.find((r) => r.crewId === crew._id && r.slotId === slot._id);
              const summary = row ? shiftCrewSummary(row, myUserId ?? undefined) : null;
              return (
                <div
                  key={crew._id}
                  className="mt-2 flex items-center gap-2 rounded-md bg-gray-50 px-3 py-1.5 dark:bg-gray-900/40"
                >
                  <p
                    className={`min-w-0 flex-1 text-xs ${
                      summary?.mine
                        ? "font-medium text-blue-700 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {shortApplianceName(crew.applianceName)}
                    </span>{" "}
                    {summary?.text || <span className="italic">no crew yet</span>}
                  </p>
                  {canEditCrews && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      aria-label={`Crew ${crew.applianceName} for ${slot.label}`}
                      onClick={() =>
                        setEditingCrew({
                          crewId: crew._id,
                          applianceName: crew.applianceName,
                          slotId: slot._id,
                          slotLabel: slot.label,
                          rosteredIds: slot.allocated.map((m) => m._id),
                          interestedIds: slot.interested.map((m) => m._id),
                          seats: row ? toSeatsDraft(row) : emptySeats(),
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <ShiftCrewDialog eventId={eventId} target={editingCrew} onClose={() => setEditingCrew(null)} />
    </div>
  );
}

/** The first few names alphabetically, always including the viewer's own. */
function previewMembers<T extends { _id: Id<"users">; firstName?: string; lastName?: string; name?: string }>(
  members: T[],
  myUserId: Id<"users"> | null,
  count: number
): T[] {
  const sorted = [...members].sort(compareUserNames);
  const preview = sorted.slice(0, count);
  const me = myUserId ? sorted.find((m) => m._id === myUserId) : undefined;
  if (me && !preview.includes(me)) preview[count - 1] = me;
  return preview;
}
