import { v } from "convex/values";

export const legacyTapeColorValidator = v.union(
  v.literal("Red"),
  v.literal("Blue"),
  v.literal("Yellow"),
  v.literal("Green"),
  v.literal("White"),
  v.literal("Black"),
  v.literal("Orange"),
  v.literal("Purple"),
  v.literal("Brown"),
  v.literal("Grey"),
  v.literal("Pink"),
  v.literal("Green/Gold Stripe"),
);

export const tapeColorValidator = v.object({
  primary: v.string(),
  secondary: v.optional(v.string()),
});

export type LegacyTapeColor =
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

export type TapeColor = {
  primary: string;
  secondary?: string;
};

const legacyTapeColors: Record<LegacyTapeColor, TapeColor> = {
  Red: { primary: "#dc2626" },
  Blue: { primary: "#2563eb" },
  Yellow: { primary: "#facc15" },
  Green: { primary: "#16a34a" },
  White: { primary: "#ffffff" },
  Black: { primary: "#000000" },
  Orange: { primary: "#f97316" },
  Purple: { primary: "#9333ea" },
  Brown: { primary: "#92400e" },
  Grey: { primary: "#6b7280" },
  Pink: { primary: "#ec4899" },
  "Green/Gold Stripe": {
    primary: "#16a34a",
    secondary: "#eab308",
  },
};

export function convertLegacyTapeColor(color: LegacyTapeColor): TapeColor {
  return legacyTapeColors[color];
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}
