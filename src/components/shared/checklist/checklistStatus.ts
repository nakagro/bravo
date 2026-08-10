/**
 * The shared vocabulary behind Duty Crew and Inventory.
 *
 * Both modules are the same workflow - work through a list, resolve every row -
 * and both had independently grown the same tri-state without ever naming it:
 *
 * - `resolved`    Duty Crew "completed"; Inventory "yes" / quantity matches expected
 * - `attention`   Duty Crew "N/A";       Inventory "no"  / quantity mismatch
 * - `unanswered`  untouched in either
 *
 * Both count resolved + attention as *answered* for progress purposes, which is
 * what makes a single progress/ring/badge implementation possible.
 */
export type ChecklistItemStatus = "resolved" | "attention" | "unanswered";

export interface ChecklistProgress {
  resolved: number;
  attention: number;
  /** resolved + attention */
  answered: number;
  total: number;
  /** answered / total, 0-100, rounded */
  percentage: number;
}

export function summariseChecklist(
  statuses: ChecklistItemStatus[],
): ChecklistProgress {
  let resolved = 0;
  let attention = 0;
  for (const status of statuses) {
    if (status === "resolved") resolved++;
    else if (status === "attention") attention++;
  }
  const answered = resolved + attention;
  const total = statuses.length;
  return {
    resolved,
    attention,
    answered,
    total,
    percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
  };
}

/**
 * Tailwind `stroke-*` classes for a ProgressRing. Red while there's outstanding
 * work, amber when everything is answered but something needs attention, green
 * when the list is genuinely clean.
 */
export function ringColorFor(progress: ChecklistProgress): string {
  if (progress.total === 0 || progress.answered < progress.total) {
    return "stroke-red-600 dark:stroke-red-500";
  }
  return progress.attention > 0
    ? "stroke-amber-500 dark:stroke-amber-400"
    : "stroke-green-500 dark:stroke-green-400";
}

/** Row container classes for a given status. */
export function statusTint(status: ChecklistItemStatus): string {
  switch (status) {
    case "resolved":
      return "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800 shadow-sm";
    case "attention":
      return "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60";
    default:
      return "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md";
  }
}
