import { query } from "./_generated/server";
import { v } from "convex/values";

// Get duty crew members with their details
export const getDutyCrewMembers = query({
  args: {
    dutyCrewId: v.id("dutyCrew"),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      rank: v.optional(v.union(
        v.literal("Probationary"),
        v.literal("Firefighter"),
        v.literal("Lieutenant"),
        v.literal("Captain")
      )),
      isLeader: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const dutyCrew = await ctx.db.get(args.dutyCrewId);
    if (!dutyCrew) {
      return [];
    }
    
    const members = [];
    
    for (const memberId of dutyCrew.members) {
      const member = await ctx.db.get(memberId);
      if (member) {
        members.push({
          _id: member._id,
          name: member.name,
          firstName: member.firstName,
          lastName: member.lastName,
          rank: member.rank,
          isLeader: dutyCrew.leader === member._id,
        });
      }
    }
    
    // Sort members: leader first, then by rank, then by name
    return members.sort((a, b) => {
      if (a.isLeader && !b.isLeader) return -1;
      if (!a.isLeader && b.isLeader) return 1;
      
      const rankOrder = { "Captain": 1, "Lieutenant": 2, "Firefighter": 3, "Probationary": 4 };
      const aRankValue = a.rank ? rankOrder[a.rank] : 5;
      const bRankValue = b.rank ? rankOrder[b.rank] : 5;
      
      if (aRankValue !== bRankValue) return aRankValue - bRankValue;
      
      const aName = a.firstName || a.name || "";
      const bName = b.firstName || b.name || "";
      return aName.localeCompare(bName);
    });
  },
});
