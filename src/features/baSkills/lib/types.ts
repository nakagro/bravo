import { Id } from "../../../../convex/_generated/dataModel";
import { CurrencyStatus } from "./currency";

export interface CurrencyMember {
  userId: Id<"users">;
  userName: string;
  skills: string[];
  lastUsageDate?: string;
  daysSinceLastUse?: number;
  daysUntilExpiry?: number;
  status: CurrencyStatus;
}

export interface CurrencyCounts {
  current: number;
  warning: number;
  expired: number;
  never_used: number;
  total: number;
}

export type SortKey = "urgency" | "name" | "daysRemaining" | "lastUsed";

/** Status filter; "at_risk" combines expired + warning to match the "Need attention" stat */
export type CurrencyFilter = CurrencyStatus | "all" | "at_risk";

export const STATUS_GROUP_ORDER: CurrencyStatus[] = [
  "expired",
  "warning",
  "never_used",
  "current",
];

/** Default expanded state per status - open the at-risk groups, collapse the rest */
export const DEFAULT_GROUP_OPEN: Record<CurrencyStatus, boolean> = {
  expired: true,
  warning: true,
  never_used: false,
  current: false,
};

export const SIX_MONTHS_DAYS = 180;
