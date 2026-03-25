import { Id } from "../../../convex/_generated/dataModel";

export type CheckItemData = {
  checkId?: Id<"stationChecks">;
  name: string;
  isCompleted: boolean;
  notes?: string;
  completedBy?: Id<"users">;
  completedAt?: number;
  isAdHoc?: boolean;
  addedBy?: Id<"users">;
};

export type SubmissionStatus = "draft" | "completed";

export const statusConfig = {
  completed: {
    label: "Completed",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-800 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
    ringColor: "stroke-green-500 dark:stroke-green-400",
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

export type TabType = "thisWeek" | "schedule" | "admin";

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
