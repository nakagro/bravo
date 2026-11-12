import { v } from "convex/values";
import { deploymentAssignmentSource } from "./deploymentSource";
import { eventAssignmentSource } from "./eventSource";
import type { AssignmentSource } from "./types";

// A new source is one adapter file, one line here, one literal in the
// validator, and its three template entries in NOTIFICATION_TEMPLATES.
export const ASSIGNMENT_SOURCES = {
  event: eventAssignmentSource, // eventCrews + eventSlotAllocations
  deploymentDay: deploymentAssignmentSource, // deploymentCrews for one date
} satisfies Record<string, AssignmentSource>;

export type AssignmentSourceKey = keyof typeof ASSIGNMENT_SOURCES;

export const assignmentSourceValidator = v.union(v.literal("event"), v.literal("deploymentDay"));
