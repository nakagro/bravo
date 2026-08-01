export type ActionItem = {
  id: string;
  moduleId: string;
  kind: string;
  title: string;
  description?: string;
  url: string;
  actionLabel?: string;
  priority: "low" | "medium" | "high";
  count?: number;
  createdAt: number;
  meta?: unknown;
  dismissible?: boolean;
};

export const priorityColors: Record<ActionItem["priority"], string> = {
  high: "border-red-500 bg-red-50 dark:bg-red-900/20",
  medium: "border-amber-400 bg-amber-50 dark:bg-amber-900/20",
  low: "border-gray-300 bg-gray-50 dark:bg-gray-800/40",
};

export const priorityBadgeColors: Record<ActionItem["priority"], string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};
