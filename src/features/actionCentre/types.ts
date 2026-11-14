import { statusToneClasses } from "@/lib/statusTone";

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

/**
 * An update reports something that happened ("inventory check completed"); a
 * to-do is something still waiting on the member. Updates are dated, sorted
 * newest first and kept out of the bell's red count - they're worth a look,
 * not a nag.
 */
export function isUpdate(action: ActionItem): boolean {
  return action.kind === "notice";
}

export const priorityColors: Record<ActionItem["priority"], string> = {
  high: "border-red-500 bg-red-50 dark:bg-red-900/20",
  medium: "border-amber-400 bg-amber-50 dark:bg-amber-900/20",
  low: "border-gray-300 bg-gray-50 dark:bg-gray-800/40",
};

export const priorityBadgeColors: Record<ActionItem["priority"], string> = {
  high: statusToneClasses.danger,
  medium: statusToneClasses.warning,
  low: statusToneClasses.neutral,
};
