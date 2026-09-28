import type { Id } from "../../../../convex/_generated/dataModel";

export interface RunUser {
  name?: string;
  firstName?: string;
  lastName?: string;
  memberNumber?: string;
}

/** A run's list-row summary, as the admin queries return it. */
export interface AdminRunSummary {
  run: {
    _id: Id<"applianceCheckRuns">;
    templateName: string;
    status: "in_progress" | "completed" | "cancelled";
    startedAt: number;
    completedAt?: number;
  };
  total: number;
  yes: number;
  no: number;
  unanswered: number;
  deviations: number;
  completedByUser?: RunUser | null;
  startedByUser?: RunUser | null;
}

export const runUserName = (user: RunUser | null | undefined) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
  user?.name ||
  "Unknown";
