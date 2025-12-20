import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get BA skills audit - shows members with BA skills and their last usage
 * Identifies members who need to use BA within 6 months to maintain qualifications
 */
export const getBASkillsAudit = query({
  args: {},
  returns: v.array(
    v.object({
      userId: v.id("users"),
      userName: v.string(),
      skills: v.array(v.string()),
      lastUsageDate: v.optional(v.string()),
      daysSinceLastUse: v.optional(v.number()),
      daysUntilExpiry: v.optional(v.number()),
      status: v.union(
        v.literal("current"), // Used within last 6 months
        v.literal("warning"), // 30-60 days until expiry
        v.literal("urgent"), // Less than 30 days until expiry
        v.literal("expired"), // Over 6 months since last use
        v.literal("never_used") // No usage records
      ),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get all users with their skills
    const allUsers = await ctx.db.query("users").collect();

    // Get all skills to map codes to names
    const allSkills = await ctx.db.query("skills").collect();
    const skillMap = new Map(allSkills.map((s) => [s._id, s]));

    // Get all BA usage records
    const allRecords = await ctx.db.query("baSkillsRecords").collect();

    // Group records by member
    const recordsByMember = new Map<string, typeof allRecords>();
    for (const record of allRecords) {
      const memberId = record.memberId;
      if (!recordsByMember.has(memberId)) {
        recordsByMember.set(memberId, []);
      }
      recordsByMember.get(memberId)!.push(record);
    }

    const auditResults = [];
    const now = Date.now();
    const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

    for (const user of allUsers) {
      // Skip users without skills or anonymous users
      if (!user.skills || user.skills.length === 0 || user.isAnonymous) {
        continue;
      }

      // Get user's skill names
      const userSkillCodes = user.skills
        .map((skillId) => {
          const skill = skillMap.get(skillId);
          return skill ? skill.code : null;
        })
        .filter(Boolean) as string[];

      // Check if user has BA skills (BAe or BAi)
      const hasBASkills = userSkillCodes.some(
        (code) => code === "BAe" || code === "BAi"
      );

      if (!hasBASkills) {
        continue;
      }

      // Get user's BA usage records
      const userRecords = recordsByMember.get(user._id) || [];

      // Find most recent usage
      let lastUsageDate: string | undefined;
      let daysSinceLastUse: number | undefined;
      let daysUntilExpiry: number | undefined;
      let status: "current" | "warning" | "urgent" | "expired" | "never_used";

      if (userRecords.length === 0) {
        status = "never_used";
      } else {
        // Sort by date (most recent first)
        const sortedRecords = userRecords.sort((a, b) => {
          return new Date(b.dateUsed).getTime() - new Date(a.dateUsed).getTime();
        });

        const mostRecentRecord = sortedRecords[0];
        lastUsageDate = mostRecentRecord.dateUsed;

        const lastUseTime = new Date(lastUsageDate).getTime();
        const timeSinceLastUse = now - lastUseTime;
        daysSinceLastUse = Math.floor(timeSinceLastUse / (24 * 60 * 60 * 1000));

        const expiryTime = lastUseTime + SIX_MONTHS_MS;
        const timeUntilExpiry = expiryTime - now;
        daysUntilExpiry = Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000));

        if (daysUntilExpiry < 0) {
          status = "expired";
        } else if (daysUntilExpiry <= 30) {
          status = "urgent";
        } else if (daysUntilExpiry <= 60) {
          status = "warning";
        } else {
          status = "current";
        }
      }

      auditResults.push({
        userId: user._id,
        userName:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          user.name ||
          "Unknown",
        skills: userSkillCodes.filter((code) => code === "BAe" || code === "BAi"),
        lastUsageDate,
        daysSinceLastUse,
        daysUntilExpiry,
        status,
      });
    }

    // Sort by status priority (expired/urgent first, then by days until expiry)
    auditResults.sort((a, b) => {
      const statusOrder = {
        expired: 0,
        urgent: 1,
        warning: 2,
        never_used: 3,
        current: 4,
      };

      const aOrder = statusOrder[a.status];
      const bOrder = statusOrder[b.status];

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      // Within same status, sort by days until expiry (ascending)
      if (a.daysUntilExpiry !== undefined && b.daysUntilExpiry !== undefined) {
        return a.daysUntilExpiry - b.daysUntilExpiry;
      }

      return 0;
    });

    return auditResults;
  },
});
