/**
 * The one palette for status colours: OK, due, overdue, info, neutral. Use a
 * tone instead of picking green/amber/red classes per module, so "in date" and
 * "approved" read the same everywhere. `<Badge tone>` applies these; use the
 * classes directly only for a pill that isn't a Badge.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export const statusToneClasses: Record<StatusTone, string> = {
  success: "border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  warning: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  info: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  neutral: "border-transparent bg-muted text-muted-foreground",
};

/** A small solid dot in the same tone, for a status mark beside a name. */
export const statusToneDotClasses: Record<StatusTone, string> = {
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-muted-foreground/60",
};
