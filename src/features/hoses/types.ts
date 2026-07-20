export type Status =
  "With district for repair" | "Condemned" | "Due for testing" | "In date";
export type Size = "25" | "38" | "65";
export type Type = "Canvas" | "Duraline";
export type Location = "Station" | "Pumper" | "Tanker" | "FCV" | "Other";

// Filter types for dashboard-to-inventory navigation
export type UpcomingTestFilter = "1month" | "3months" | "6months";
export type OverdueFilter =
  "overdue3months" | "overdue6months" | "overdue12months" | "overdue12plus";
export type HoseFilterType = Status | UpcomingTestFilter | OverdueFilter | null;

// Tab configuration for HosesPage
export type HoseTab =
  "dashboard" | "inventory" | "audit" | "sync" | "tapeColors";

export const hoseTabs: { key: HoseTab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "inventory", label: "Inventory" },
  { key: "audit", label: "Audit" },
  { key: "sync", label: "Sync" },
  { key: "tapeColors", label: "Tape Colours" },
];

// Electrical tape wrapped around a hose coupling identifies its test year.
// A secondary colour represents tape with two repeating stripes.
export type TapeColor = {
  primary: string;
  secondary?: string;
};

export const defaultTapeColor: TapeColor = { primary: "#dc2626" };
export const defaultStripeColor = "#eab308";

export function getTapeColorStyle(color: TapeColor): { background: string } {
  return {
    background: color.secondary
      ? `repeating-linear-gradient(0deg, ${color.primary} 0, ${color.primary} 4px, ${color.secondary} 4px, ${color.secondary} 8px)`
      : color.primary,
  };
}

export const statusColors = {
  Condemned: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  "Due for testing":
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  "With district for repair":
    "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  "In date":
    "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
} as const;

// Border colors for card left accent
export const statusBorderColors = {
  Condemned: "border-l-red-500 dark:border-l-red-400",
  "Due for testing": "border-l-yellow-500 dark:border-l-yellow-400",
  "With district for repair": "border-l-blue-500 dark:border-l-blue-400",
  "In date": "border-l-green-500 dark:border-l-green-400",
} as const;

export const locationOptions: Location[] = [
  "Station",
  "Pumper",
  "Tanker",
  "FCV",
  "Other",
];
