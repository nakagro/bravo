export type Status = "With district for repair" | "Condemned" | "Due for testing" | "In date";
export type Size = "25" | "38" | "65";
export type Type = "Canvas" | "Duraline";
export type Location = "Station" | "Pumper" | "Tanker" | "FCV" | "Other";

// Filter types for dashboard-to-inventory navigation
export type UpcomingTestFilter = "1month" | "3months" | "6months";
export type OverdueFilter = "overdue3months" | "overdue6months" | "overdue12months" | "overdue12plus";
export type HoseFilterType = Status | UpcomingTestFilter | OverdueFilter | null;

// Tab configuration for HosesPage
export type HoseTab = "dashboard" | "inventory" | "audit" | "sync" | "tapeColors";

export const hoseTabs: { key: HoseTab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "inventory", label: "Inventory" },
  { key: "audit", label: "Audit" },
  { key: "sync", label: "Sync" },
  { key: "tapeColors", label: "Tape Colours" },
];

// Test tape colour coding - the colour of electrical tape wrapped around hose
// couplings signifies the year a hose was last tested. Most years use a solid
// colour, but "Green/Gold Stripe" covers the Australian earth/ground striped
// tape occasionally used instead.
export type TapeColor =
  | "Red"
  | "Blue"
  | "Yellow"
  | "Green"
  | "White"
  | "Black"
  | "Orange"
  | "Purple"
  | "Brown"
  | "Grey"
  | "Pink"
  | "Green/Gold Stripe";

export const tapeColorOptions: TapeColor[] = [
  "Red",
  "Blue",
  "Yellow",
  "Green",
  "White",
  "Black",
  "Orange",
  "Purple",
  "Brown",
  "Grey",
  "Pink",
  "Green/Gold Stripe",
];

// Swatch classes for each tape colour. "Green/Gold Stripe" uses a striped
// gradient instead of a flat background to reflect the real tape; the bands
// run horizontally (along the tape length), matching the real earth tape.
export const tapeColorSwatchClasses: Record<TapeColor, string> = {
  Red: "bg-red-600",
  Blue: "bg-blue-600",
  Yellow: "bg-yellow-400",
  Green: "bg-green-600",
  White: "bg-white border border-gray-300 dark:border-gray-600",
  Black: "bg-black",
  Orange: "bg-orange-500",
  Purple: "bg-purple-600",
  Brown: "bg-amber-800",
  Grey: "bg-gray-500",
  Pink: "bg-pink-500",
  "Green/Gold Stripe":
    "bg-[repeating-linear-gradient(0deg,#16a34a_0,#16a34a_4px,#eab308_4px,#eab308_8px)]",
};

// Badge classes (background + text) for each tape colour, used where a
// coloured pill/label is shown rather than a plain swatch.
export const tapeColorBadgeClasses: Record<TapeColor, string> = {
  Red: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  Blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  Yellow: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  Green: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  White: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600",
  Black: "bg-gray-800 dark:bg-black text-white",
  Orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
  Purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
  Brown: "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300",
  Grey: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
  Pink: "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300",
  "Green/Gold Stripe":
    "bg-gradient-to-r from-green-100 to-yellow-100 dark:from-green-900/30 dark:to-yellow-900/30 text-green-900 dark:text-yellow-200",
};

export const statusColors = {
  "Condemned": "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  "Due for testing": "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  "With district for repair": "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  "In date": "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
} as const;

// Border colors for card left accent
export const statusBorderColors = {
  "Condemned": "border-l-red-500 dark:border-l-red-400",
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
