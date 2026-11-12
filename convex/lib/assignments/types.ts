import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

// The one thing each module writes to send assignment notices: an adapter
// that says who may send for a scope and what each member holds in it. The
// diff, receipts, templates, confirm step and delivery are shared
// (convex/assignmentNotices.ts).

export type Assignment = {
  userId: Id<"users">;
  /** One line per thing they hold: "Driver · Tanker 1", "Shift 2 (10:00–12:00)". */
  lines: string[];
  /** Per-member placeholder overrides, e.g. an empty {time} when they only hold shifts. */
  values?: Record<string, string>;
};

export type AssignmentScope = {
  scopeKey: string; // "event:<id>" | "deployment:<dateMs>"
  templatePrefix: "event" | "deployment"; // picks event.assigned etc.
  moduleId: string; // module gate for the Action Centre item + push
  notificationType: string; // pref category lookup
  url: string; // deep link to the source page
  /** Scope-wide placeholder values: {eventTitle}, {date}, {time}, {location}. */
  values: Record<string, string>;
  assignments: Assignment[]; // members only
  externalNames: string[]; // typed-name seats, never notified
};

export type AssignmentSource = {
  /** The caller's id if they may send for this scope, otherwise null. Never throws. */
  senderId(ctx: QueryCtx, scopeId: string): Promise<Id<"users"> | null>;
  /** Null when the scope is gone or closed to sending (cancelled or past). */
  load(ctx: QueryCtx, scopeId: string): Promise<AssignmentScope | null>;
  /** Optional: write the source's own audit entry for a send. */
  recordSend?(ctx: MutationCtx, scopeId: string, senderId: Id<"users">, summary: string): Promise<void>;
};
