import type { QueryCtx } from "../../_generated/server";
import { moduleSettingAllows } from "../../modules";
import { seatLines } from "../crewSeats";
import { brigadeDateStr } from "../dates";
import { formatDayMs } from "../notificationTemplates";
import type { Assignment, AssignmentSource } from "./types";
import { getActiveUser } from "../../lib/access";

// Deployment → Crews for one day (scopeId = the UTC-midnight date as a
// string). Fills {date} and, per member, {assignment}. Default text:
//   Deployment crew: Sat 14 Dec
//   Driver on Tanker 1
//   Tap to see the full crew.
// Sent only by availabilityAdmin, the people who set the crews.

const CREWING_MODULE = "availabilityAdmin";

function parseDay(scopeId: string): number | null {
  const ms = Number(scopeId);
  if (!Number.isFinite(ms) || ms % 86_400_000 !== 0) return null;
  return ms;
}

export function deploymentDayIsPast(dateMs: number): boolean {
  return new Date(dateMs).toISOString().slice(0, 10) < brigadeDateStr();
}

export async function canCrewDeployments(ctx: QueryCtx) {
  const user = await getActiveUser(ctx);
  if (!user) return null;
  const userId = user._id;
  if (user.isAdmin) return userId;
  const setting = await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", CREWING_MODULE))
    .first();
  return moduleSettingAllows(user, setting) ? userId : null;
}

export const deploymentAssignmentSource: AssignmentSource = {
  async senderId(ctx, scopeId) {
    if (parseDay(scopeId) === null) return null;
    return await canCrewDeployments(ctx);
  },

  async load(ctx, scopeId) {
    const date = parseDay(scopeId);
    if (date === null || deploymentDayIsPast(date)) return null;

    const crews = (
      await ctx.db
        .query("deploymentCrews")
        .withIndex("by_date", (q) => q.eq("date", date))
        .collect()
    ).sort((a, b) => a.applianceName.localeCompare(b.applianceName));

    const held = new Map<string, Assignment>();
    const externalNames: string[] = [];
    for (const crew of crews) {
      const { members, external } = seatLines(crew);
      for (const m of members) {
        const a = held.get(m.userId) ?? { userId: m.userId, lines: [] };
        a.lines.push(m.line);
        held.set(m.userId, a);
      }
      externalNames.push(...external);
    }

    return {
      scopeKey: `deployment:${date}`,
      templatePrefix: "deployment",
      moduleId: "availability",
      notificationType: "deploymentAssignment",
      url: "/availability?tab=deployment&view=crews",
      values: { date: formatDayMs(date) },
      assignments: [...held.values()],
      externalNames,
    };
  },
  // No history table for deployment crews: the receipts (sentBy, sentAt) are the record.
};
