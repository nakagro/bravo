export type Status = "With district for repair" | "Condemned" | "Due for testing" | "In date";
export type Size = "25" | "38" | "65";
export type Type = "Canvas" | "Duraline";
export type Location = "Station" | "Pumper" | "Tanker" | "FCV" | "Other";

export const statusColors = {
  "Condemned": "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  "Due for testing": "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  "With district for repair": "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  "In date": "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
} as const;

export const locationOptions: Location[] = [
  "Station",
  "Pumper",
  "Tanker",
  "FCV",
  "Other",
];
