import { TriangleAlert, Clock, CircleCheckBig, CircleHelp, type LucideIcon } from "lucide-react";
import { statusToneClasses } from "@/lib/statusTone";

export type CurrencyStatus = "current" | "warning" | "expired" | "never_used";

export interface StatusMeta {
  label: string;
  badgeClass: string;
  cardBorderClass: string;
  textClass: string;
  /** Solid background colour for the dot / health-bar segment */
  solidClass: string;
  /** Inline progress-bar fill colour */
  fillClass: string;
  icon: LucideIcon;
}

export const STATUS_META: Record<CurrencyStatus, StatusMeta> = {
  expired: {
    label: "Expired",
    badgeClass: statusToneClasses.danger,
    cardBorderClass: "border-red-200 dark:border-red-900",
    textClass: "text-red-600 dark:text-red-400",
    solidClass: "bg-red-600",
    fillClass: "bg-red-500",
    icon: TriangleAlert,
  },
  warning: {
    label: "Expiring soon",
    badgeClass: statusToneClasses.warning,
    cardBorderClass: "border-orange-200 dark:border-orange-900",
    textClass: "text-orange-600 dark:text-orange-400",
    solidClass: "bg-orange-500",
    fillClass: "bg-orange-500",
    icon: Clock,
  },
  never_used: {
    label: "Never used",
    badgeClass: statusToneClasses.neutral,
    cardBorderClass: "border-gray-200 dark:border-gray-700",
    textClass: "text-gray-600 dark:text-gray-400",
    solidClass: "bg-gray-400",
    fillClass: "bg-gray-400",
    icon: CircleHelp,
  },
  current: {
    label: "Current",
    badgeClass: statusToneClasses.success,
    cardBorderClass: "border-green-200 dark:border-green-900",
    textClass: "text-green-600 dark:text-green-400",
    solidClass: "bg-green-500",
    fillClass: "bg-green-500",
    icon: CircleCheckBig,
  },
};

export function statusMessage(
  status: CurrencyStatus,
  daysUntilExpiry?: number,
  daysSinceLastUse?: number,
): string {
  switch (status) {
    case "expired":
      return `Expired ${Math.abs(daysUntilExpiry ?? 0)} days ago. Use BA to regain currency`;
    case "warning":
      return `${daysUntilExpiry} days remaining. Use BA within 2 weeks`;
    case "never_used":
      return "No BA usage recorded";
    case "current":
      return `Last used ${daysSinceLastUse} days ago · ${daysUntilExpiry} days remaining`;
  }
}

export const USAGE_TYPE_LABEL: Record<"firecall" | "drill", string> = {
  firecall: "Fire Call",
  drill: "Drill",
};
