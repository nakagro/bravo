import { Id } from "../../../convex/_generated/dataModel";
import type { ChecklistItemStatus } from "@/components/shared/checklist";

export type CheckItemData = {
  checkId?: Id<"stationChecks">;
  subItemId?: Id<"stationCheckSubitems">;
  parentCheckId?: Id<"stationChecks">;
  name: string;
  area?: string;
  isPriority?: boolean;
  isCompleted: boolean;
  isNotApplicable?: boolean;
  notes?: string;
  completedBy?: Id<"users">;
  completedAt?: number;
  isAdHoc?: boolean;
  addedBy?: Id<"users">;
};

/**
 * Derived state for a check that is satisfied by an inventory run rather than
 * by ticking. Deliberately *not* a field on CheckItemData: that type is the
 * mutation payload, and an extra field would be rejected by the server's
 * validator. Passed alongside, keyed by check id.
 */
export type LinkedInventoryInfo = {
  templateId: Id<"applianceTemplates">;
  templateName: string;
  templateStatus: "active" | "inactive" | "archived";
  completedRunId?: Id<"applianceCheckRuns">;
  completedAt?: number;
  completedBy?: Id<"users">;
  completedByName?: string;
  inProgressRunId?: Id<"applianceCheckRuns">;
};

// An item counts toward submission when it is either completed or marked N/A
export const isItemResolved = (item: {
  isCompleted: boolean;
  isNotApplicable?: boolean;
}) => item.isCompleted || item.isNotApplicable === true;

/** Duty Crew's adapter onto the shared checklist vocabulary. */
export const checkItemStatus = (item: {
  isCompleted: boolean;
  isNotApplicable?: boolean;
}): ChecklistItemStatus =>
  item.isCompleted
    ? "resolved"
    : item.isNotApplicable === true
      ? "attention"
      : "unanswered";

export { weekBoundaries } from "@/lib/dutyWeek";

/**
 * A local date as UTC midnight of the same calendar day, for backend queries
 * that key on a day. Convex runs in UTC, so sending a local midnight from AEST
 * lands the server on the previous day - which silently emptied the Duty Crew
 * hero for every week until it was caught.
 */
export const toUtcMidnight = (date: Date) =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

export type SubmissionStatus = "draft" | "completed";

export type ItemUser = {
  _id: Id<"users">;
  name: string;
  firstName?: string;
  lastName?: string;
};

export type AllocationTarget =
  | { kind: "area"; area: string }
  | { kind: "check"; checkId: Id<"stationChecks"> }
  | { kind: "subitem"; subItemId: Id<"stationCheckSubitems"> };

export type CrewAssignmentMember = {
  _id: Id<"users">;
  name?: string;
  firstName?: string;
  lastName?: string;
};

export const allocationTargetKey = (target: AllocationTarget) => {
  if (target.kind === "area") return `area:${target.area.trim()}`;
  if (target.kind === "check") return `check:${target.checkId}`;
  return `subitem:${target.subItemId}`;
};

export const statusConfig = {
  // "completed" is the stored status of a week that has closed. It says
  // nothing about whether every item got done, so it isn't painted green.
  completed: {
    label: "Week Closed",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    ringColor: "stroke-blue-500 dark:stroke-blue-400",
  },
  draft: {
    label: "In Progress",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-800 dark:text-yellow-300",
    border: "border-yellow-200 dark:border-yellow-800",
    ringColor: "stroke-yellow-500 dark:stroke-yellow-400",
  },
  not_started: {
    label: "Not Started",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700",
    ringColor: "stroke-gray-400 dark:stroke-gray-500",
  },
} as const;

export type TabType = "thisWeek" | "schedule" | "history" | "admin";

export const ordinalSuffix = (n: number) =>
  n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

export const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatDateShort = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

export const formatMonthYear = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });
};

export const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getUserFullName = (user: {
  firstName?: string;
  lastName?: string;
  name?: string;
}) => {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.name || "Unknown";
};

export const getUserInitials = (user: {
  firstName?: string;
  lastName?: string;
  name?: string;
}) => {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  return (user.name || "?")[0].toUpperCase();
};
