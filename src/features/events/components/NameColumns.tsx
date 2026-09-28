import { compareUserNames, formatUserName } from "../types";
import { TeamLeaderBadge } from "./badges";

export interface NameListMember {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

interface NameColumnsProps {
  members: NameListMember[];
  myUserId?: string | null;
  leaderIds?: string[];
  /** Extra heads each member is bringing, shown as a quiet "+2" */
  guestCounts?: Map<string, number>;
  /** The bench rather than the roster - same layout, lighter text */
  muted?: boolean;
}

/**
 * A long list of people as plain names in aligned columns, alphabetical down
 * each column. Replaces the pill clouds, which were fine at five names and
 * unreadable at thirty: uneven shapes give the eye no line to follow, and every
 * border competes with the names. A column is scannable, and at ~24px a row it
 * is shorter than the pills were.
 */
export function NameColumns({
  members,
  myUserId,
  leaderIds = [],
  guestCounts,
  muted = false,
}: NameColumnsProps) {
  const sorted = [...members].sort(compareUserNames);
  return (
    <ul className="columns-2 sm:columns-3 gap-x-6">
      {sorted.map((member) => {
        const name = formatUserName(member);
        const isMe = member._id === myUserId;
        const guests = guestCounts?.get(member._id) ?? 0;
        return (
          <li
            key={member._id}
            className="flex min-w-0 items-baseline gap-1.5 break-inside-avoid py-0.5 text-sm"
          >
            <span
              title={name}
              className={`truncate ${
                isMe
                  ? "font-semibold text-gray-900 dark:text-white"
                  : muted
                    ? "text-gray-500 dark:text-gray-400"
                    : "text-gray-800 dark:text-gray-200"
              }`}
            >
              {name}
            </span>
            {guests > 0 && (
              <span
                title={`Bringing ${guests} ${guests === 1 ? "guest" : "guests"}`}
                className="shrink-0 text-xs text-gray-500 dark:text-gray-400"
              >
                +{guests}
              </span>
            )}
            {leaderIds.includes(member._id) && <TeamLeaderBadge compact className="shrink-0" />}
            {isMe && <span className="shrink-0 text-xs text-red-700 dark:text-red-300">you</span>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The same people as one running sentence - for the secondary list under a
 * roster ("Also interested: ..."), where it should read as background and take
 * a line or two, not a block.
 */
export function NameSentence({
  label,
  members,
  myUserId,
  leaderIds = [],
  className = "",
}: {
  label: string;
  members: NameListMember[];
  myUserId?: string | null;
  leaderIds?: string[];
  className?: string;
}) {
  const sorted = [...members].sort(compareUserNames);
  return (
    <p className={`text-xs leading-relaxed ${className}`}>
      <span className="font-semibold">{label}: </span>
      {sorted.map((member, index) => {
        const isMe = member._id === myUserId;
        return (
          <span key={member._id}>
            <span className={isMe ? "font-semibold text-gray-900 dark:text-white" : undefined}>
              {formatUserName(member)}
            </span>
            {leaderIds.includes(member._id) && " (Lead)"}
            {isMe && " (you)"}
            {index < sorted.length - 1 && ", "}
          </span>
        );
      })}
    </p>
  );
}
