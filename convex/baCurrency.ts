import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { isMemberAccount } from "./lib/accountType";

const SIX_MONTHS_DAYS = 180;
// Warning triggers when a member is within 2 weeks of their currency expiring.
const WARNING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const SIX_MONTHS_MS = SIX_MONTHS_DAYS * DAY_MS;

const statusValidator = v.union(
  v.literal("current"),
  v.literal("warning"),
  v.literal("expired"),
  v.literal("never_used"),
);

type Status = "current" | "warning" | "expired" | "never_used";

function userDisplayName(user: Doc<"users"> | null | undefined): string {
  if (!user) return "Unknown";
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return full || user.name || "Unknown";
}

function computeStatus(lastUseTime: number | undefined, now: number) {
  if (lastUseTime === undefined) {
    return {
      status: "never_used" as Status,
      daysSinceLastUse: undefined as number | undefined,
      daysUntilExpiry: undefined as number | undefined,
    };
  }
  const daysSinceLastUse = Math.floor((now - lastUseTime) / DAY_MS);
  const daysUntilExpiry = Math.floor((lastUseTime + SIX_MONTHS_MS - now) / DAY_MS);
  let status: Status;
  if (daysUntilExpiry < 0) status = "expired";
  else if (daysUntilExpiry <= WARNING_DAYS) status = "warning";
  else status = "current";
  return { status, daysSinceLastUse, daysUntilExpiry };
}

const myCurrencyValidator = v.object({
  hasBASkills: v.boolean(),
  skills: v.array(v.string()),
  status: statusValidator,
  lastUsageDate: v.optional(v.string()),
  daysSinceLastUse: v.optional(v.number()),
  daysUntilExpiry: v.optional(v.number()),
});

/**
 * Current user's BA currency status. Returns hasBASkills=false if user has no BA skills.
 */
export const getMyCurrency = query({
  args: {},
  returns: v.union(myCurrencyValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const allSkills = await ctx.db.query("skills").collect();
    const skillMap = new Map(allSkills.map((s) => [s._id, s]));
    const userSkillCodes = (user.skills || [])
      .map((id) => skillMap.get(id)?.code)
      .filter((c): c is string => Boolean(c));
    const baSkills = userSkillCodes.filter((c) => c === "BAe" || c === "BAi");

    if (baSkills.length === 0) {
      return {
        hasBASkills: false,
        skills: [],
        status: "never_used" as Status,
        lastUsageDate: undefined,
        daysSinceLastUse: undefined,
        daysUntilExpiry: undefined,
      };
    }

    const records = await ctx.db
      .query("baRecords")
      .withIndex("by_member_date", (q) => q.eq("memberId", userId))
      .order("desc")
      .take(1);

    const now = Date.now();
    const lastUsageDate = records[0]?.dateUsed;
    const lastUseTime = lastUsageDate ? new Date(lastUsageDate).getTime() : undefined;
    const computed = computeStatus(lastUseTime, now);

    return {
      hasBASkills: true,
      skills: baSkills,
      ...computed,
      lastUsageDate,
    };
  },
});

const memberCurrencyValidator = v.object({
  userId: v.id("users"),
  userName: v.string(),
  skills: v.array(v.string()),
  lastUsageDate: v.optional(v.string()),
  daysSinceLastUse: v.optional(v.number()),
  daysUntilExpiry: v.optional(v.number()),
  status: statusValidator,
});

/**
 * Brigade-wide currency view. Replaces the old getBASkillsAudit query.
 */
export const getBrigadeCurrency = query({
  args: {},
  returns: v.object({
    members: v.array(memberCurrencyValidator),
    counts: v.object({
      current: v.number(),
      warning: v.number(),
      expired: v.number(),
      never_used: v.number(),
      total: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        members: [],
        counts: { current: 0, warning: 0, expired: 0, never_used: 0, total: 0 },
      };
    }

    const [allUsers, allSkills, allRecords] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("skills").collect(),
      ctx.db.query("baRecords").collect(),
    ]);

    const skillMap = new Map(allSkills.map((s) => [s._id, s]));

    const recordsByMember = new Map<Id<"users">, Doc<"baRecords">[]>();
    for (const r of allRecords) {
      const arr = recordsByMember.get(r.memberId) || [];
      arr.push(r);
      recordsByMember.set(r.memberId, arr);
    }

    const now = Date.now();
    const members: Array<{
      userId: Id<"users">;
      userName: string;
      skills: string[];
      lastUsageDate?: string;
      daysSinceLastUse?: number;
      daysUntilExpiry?: number;
      status: Status;
    }> = [];

    for (const user of allUsers) {
      if (!isMemberAccount(user) || !user.skills || user.skills.length === 0) continue;
      const userSkillCodes = user.skills
        .map((id) => skillMap.get(id)?.code)
        .filter((c): c is string => Boolean(c));
      const baSkills = userSkillCodes.filter((c) => c === "BAe" || c === "BAi");
      if (baSkills.length === 0) continue;

      const userRecords = recordsByMember.get(user._id) || [];
      let lastUsageDate: string | undefined;
      let lastUseTime: number | undefined;
      if (userRecords.length > 0) {
        const sorted = [...userRecords].sort(
          (a, b) => new Date(b.dateUsed).getTime() - new Date(a.dateUsed).getTime(),
        );
        lastUsageDate = sorted[0].dateUsed;
        lastUseTime = new Date(lastUsageDate).getTime();
      }

      const computed = computeStatus(lastUseTime, now);
      members.push({
        userId: user._id,
        userName: userDisplayName(user),
        skills: baSkills,
        lastUsageDate,
        ...computed,
      });
    }

    const statusOrder: Record<Status, number> = {
      expired: 0,
      warning: 1,
      never_used: 2,
      current: 3,
    };
    members.sort((a, b) => {
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      if (a.daysUntilExpiry !== undefined && b.daysUntilExpiry !== undefined) {
        return a.daysUntilExpiry - b.daysUntilExpiry;
      }
      return a.userName.localeCompare(b.userName);
    });

    const counts = {
      current: 0,
      warning: 0,
      expired: 0,
      never_used: 0,
      total: members.length,
    };
    for (const m of members) counts[m.status] += 1;

    return { members, counts };
  },
});
