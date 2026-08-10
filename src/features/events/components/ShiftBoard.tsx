import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { formatSlotWhen, slotCoverageLabel, getInitials, formatUserName } from "../types";

interface ShiftBoardProps {
  eventId: Id<"events">;
}

/** A member as it arrives on a slot (roster or interest list). */
interface SlotMember {
  _id: Id<"users">;
  firstName?: string;
  lastName?: string;
  name?: string;
  /** Rostered but has since marked "can't make it" - a conflict to surface */
  declined?: boolean;
}

/**
 * Zone 3 read-only turnout board for a shift event - the communal noticeboard.
 *
 * Purely display: no toggles, no input (the caller expresses interest in the
 * SlotPicker card above). Because nothing here is interactive, showing the
 * confirmed roster and the interested bench side by side reads plainly as "who's
 * on / who's available", not as a control.
 *
 * Each shift shows two tiers that only ever grow - the roster never wipes out
 * the interest list:
 *  - "Rostered" - the confirmed people the organiser has allocated (solid).
 *  - "Interested" / "Also interested" - everyone who put their hand up but isn't
 *    (yet) rostered (muted). Before allocation this is the whole story; after,
 *    it's the bench, so nobody who offered ever disappears.
 */
export function ShiftBoard({ eventId }: ShiftBoardProps) {
  const slots = useQuery(api.events.getEventSlots, { eventId });
  // Marks "you" in the lists - the one thing you can't work out by looking,
  // since offers get spread across shifts by the organiser
  const myUserId = useQuery(api.messages.getCurrentUserId);

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
    <div className="space-y-5">
      {slots.map((slot) => {
        const when = formatSlotWhen(slot);
        const rostered = slot.allocated;
        // The bench: interested but not on the roster. Dedupe against the roster
        // so someone interested who then got allocated only shows once (rostered).
        const rosteredIds = new Set(rostered.map((m) => m._id));
        const interested = slot.interested.filter((m) => !rosteredIds.has(m._id));
        const underfilled = !!slot.targetCount && slot.allocatedCount < slot.targetCount;
        const empty = rostered.length === 0 && interested.length === 0;
        return (
          <div key={slot._id}>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {slot.label}
              </span>
              {when && <span className="text-xs text-gray-500 dark:text-gray-400">{when}</span>}
              {slot.targetCount ? (
                <span
                  className={`ml-auto px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                    underfilled
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {slotCoverageLabel(slot.allocatedCount, slot.targetCount)} rostered
                </span>
              ) : null}
            </div>

            {empty ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1.5">Nobody yet</p>
            ) : (
              <div className="mt-1.5 space-y-2">
                {rostered.length > 0 && (
                  <BoardTier
                    label="Rostered"
                    members={rostered}
                    tone="rostered"
                    myUserId={myUserId ?? null}
                  />
                )}
                {interested.length > 0 && (
                  <BoardTier
                    // Before anyone's rostered, interest is the whole picture;
                    // after, it's the bench of people still available
                    label={rostered.length > 0 ? "Also interested" : "Interested"}
                    members={interested}
                    tone="interested"
                    myUserId={myUserId ?? null}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A labelled row of member chips inside a shift block. Two tones:
 *  - "rostered" - confirmed, solid indigo.
 *  - "interested" - expressed interest, muted with a dashed edge so the bench
 *    reads lighter than the roster without disappearing.
 * "You" (red) and "can't make it" (struck-through red) always win over the tone.
 */
function BoardTier({
  label,
  members,
  tone,
  myUserId,
}: {
  label: string;
  members: SlotMember[];
  tone: "rostered" | "interested";
  myUserId: Id<"users"> | null;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500 mb-1">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {members.map((member) => (
          <BoardChip
            key={member._id}
            member={member}
            tone={tone}
            isMe={member._id === myUserId}
          />
        ))}
      </div>
    </div>
  );
}

function BoardChip({
  member,
  tone,
  isMe,
}: {
  member: SlotMember;
  tone: "rostered" | "interested";
  isMe: boolean;
}) {
  if (member.declined) {
    return (
      <span
        title={`${formatUserName(member)}: can't make it`}
        className="inline-flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 line-through"
      >
        <span className="h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center">
          <XMarkIcon className="h-3 w-3" />
        </span>
        {formatUserName(member)}
      </span>
    );
  }
  const muted = tone === "interested" && !isMe;
  return (
    <span
      className={`inline-flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full border text-xs ${
        isMe
          ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-gray-900 dark:text-white font-medium"
          : muted
            ? "bg-transparent border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full text-[9px] font-bold flex items-center justify-center ${
          isMe
            ? "bg-red-600 text-white"
            : muted
              ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              : "bg-indigo-600 text-white"
        }`}
      >
        {getInitials(member)}
      </span>
      {formatUserName(member)}
      {isMe && <span className="text-[10px] text-red-700 dark:text-red-300">you</span>}
    </span>
  );
}
