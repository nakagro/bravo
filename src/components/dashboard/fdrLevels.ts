import type { CSSProperties } from "react";

// Australian Fire Danger Rating System levels, shared by the dashboard widget
// and the /fdr page. Colours are the official AFDRS palette; "No Rating" has
// no official colour, so it uses muted Tailwind classes that follow the app's
// dark mode toggle.
export interface FdrLevel {
  key: "NO RATING" | "MODERATE" | "HIGH" | "EXTREME" | "CATASTROPHIC";
  label: string;
  fbi: string;
  /** The AFDRS key action message for this level. */
  action: string;
  style: CSSProperties;
}

export const FDR_LEVELS: FdrLevel[] = [
  {
    key: "NO RATING",
    label: "No Rating",
    fbi: "< 12",
    action: "Low fire danger. Fires can still start, so check local restrictions.",
    style: {},
  },
  {
    key: "MODERATE",
    label: "Moderate",
    fbi: "12-23",
    action: "Plan and prepare.",
    style: { backgroundColor: "#67b436", color: "#000" },
  },
  {
    key: "HIGH",
    label: "High",
    fbi: "24-49",
    action: "Be ready to act.",
    style: { backgroundColor: "#fcdd37", color: "#000" },
  },
  {
    key: "EXTREME",
    label: "Extreme",
    fbi: "50-99",
    action: "Take action now to protect your life and property.",
    style: { backgroundColor: "#f0820e", color: "#000" },
  },
  {
    key: "CATASTROPHIC",
    label: "Catastrophic",
    fbi: "100+",
    action: "For your survival, leave bushfire risk areas.",
    style: { backgroundColor: "#af1917", color: "#fff" },
  },
];

/** "No Rating" on top of a card: one step lighter than the gray-800 card. */
export const NO_RATING_CLASSES = "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
/** "No Rating" standing on the page background, like a card. */
export const NO_RATING_CARD_CLASSES = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

const findLevel = (category: string) =>
  FDR_LEVELS.find((l) => l.key === category?.toUpperCase()) ?? FDR_LEVELS[0];

/** Inline colour for rated levels plus classes for "No Rating". */
export function fdrAppearance(
  category: string,
  noRatingClasses = NO_RATING_CLASSES,
): { style: CSSProperties; className: string } {
  const level = findLevel(category);
  return { style: level.style, className: level.key === "NO RATING" ? noRatingClasses : "" };
}

export function fdrLabel(category: string): string {
  return category
    ? category
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")
    : "No Rating";
}
