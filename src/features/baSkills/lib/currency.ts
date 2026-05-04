import { TriangleAlert, Clock, CircleCheckBig, CircleHelp, type LucideIcon } from "lucide-react";

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
    badgeClass: "bg-red-600 text-white hover:bg-red-700",
    cardBorderClass: "border-red-200 dark:border-red-900",
    textClass: "text-red-600 dark:text-red-400",
    solidClass: "bg-red-600",
    fillClass: "bg-red-500",
    icon: TriangleAlert,
  },
  warning: {
    label: "Expiring soon",
    badgeClass: "bg-orange-500 text-white hover:bg-orange-600",
    cardBorderClass: "border-orange-200 dark:border-orange-900",
    textClass: "text-orange-600 dark:text-orange-400",
    solidClass: "bg-orange-500",
    fillClass: "bg-orange-500",
    icon: Clock,
  },
  never_used: {
    label: "Never used",
    badgeClass: "bg-gray-500 text-white hover:bg-gray-600",
    cardBorderClass: "border-gray-200 dark:border-gray-700",
    textClass: "text-gray-600 dark:text-gray-400",
    solidClass: "bg-gray-400",
    fillClass: "bg-gray-400",
    icon: CircleHelp,
  },
  current: {
    label: "Current",
    badgeClass: "bg-green-600 text-white hover:bg-green-700",
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
      return `Expired ${Math.abs(daysUntilExpiry ?? 0)} days ago — use BA to regain currency`;
    case "warning":
      return `${daysUntilExpiry} days remaining — use BA within 2 weeks`;
    case "never_used":
      return "No BA usage recorded";
    case "current":
      return `Last used ${daysSinceLastUse} days ago · ${daysUntilExpiry} days remaining`;
  }
}

export const USAGE_TYPE_LABEL: Record<"firecall" | "drill", string> = {
  firecall: "Fire Call",
  drill: "Training / Drill",
};
