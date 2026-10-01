import { v } from "convex/values";
import type { Infer } from "convex/values";

/** Every status a member can hold on the board. */
export const mainStatusValidator = v.union(
  v.literal("available - station"),
  v.literal("available - at station"),
  v.literal("available - satellite"),
  v.literal("not available"),
  v.literal("delayed response"),
  v.literal("WFH"),
  v.literal("WFH - at station"),
);

/**
 * What a timed status turns into when it runs out. "reset" is the special value
 * meaning "clear the status", the same as the nightly reset does.
 */
export const nextStatusValidator = v.union(
  v.literal("available - station"),
  v.literal("available - at station"),
  v.literal("available - satellite"),
  v.literal("not available"),
  v.literal("delayed response"),
  v.literal("WFH"),
  v.literal("WFH - at station"),
  v.literal("reset"),
);

/**
 * The statuses a planned shift can set. The "at station" variants are left out
 * because a shift is scheduled time away.
 */
export const plannedStatusValidator = v.union(
  v.literal("not available"),
  v.literal("delayed response"),
  v.literal("WFH"),
);

export type MainStatus = Infer<typeof mainStatusValidator>;
export type NextStatus = Infer<typeof nextStatusValidator>;
export type PlannedStatus = Infer<typeof plannedStatusValidator>;
