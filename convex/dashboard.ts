import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

interface PendingAction {
  _id: string;
  title: string;
  description: string;
  actionUrl?: string;
  priority: "low" | "medium" | "high";
  createdAt: number;
}

/**
 * Get pending actions for the current user
 * 
 * Checks user's availability status and other conditions to determine
 * what actions need to be taken.
 */
export const getPendingActions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.string(),
      title: v.string(),
      description: v.string(),
      actionUrl: v.optional(v.string()),
      priority: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    // Get the current authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const pendingActions: PendingAction[] = [];
    
    // Get the user's data
    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }
    
    // Calculate the timestamp for 4am of the current day (same logic as in availability.ts)
    const now = new Date();
    const today4am = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      4, // 4am
      0, // 0 minutes
      0, // 0 seconds
      0 // 0 milliseconds
    ).getTime();
    
    // If current time is before 4am, use 4am from the previous day
    const cutoffTime = now.getHours() < 4 ? 
      today4am - 24 * 60 * 60 * 1000 : // Subtract one day if before 4am
      today4am;
    
    // Check if the user needs to update their availability status
    const isStatusCurrent = user.statusUpdatedAt && user.statusUpdatedAt >= cutoffTime;
    
    if (!isStatusCurrent) {
      pendingActions.push({
        _id: "update-availability",
        title: "Update Your Availability",
        description: "Your availability status needs to be updated. Please set your current availability status.",
        actionUrl: "/availability",
        priority: "high",
        createdAt: Date.now(),
      });
    }
    
    // Check if the user has updated their skills
    if (!user.skills || user.skills.length === 0) {
      pendingActions.push({
        _id: "update-skills",
        title: "Update Your Skills",
        description: "Please update your skills in the User Settings to help with brigade planning.",
        actionUrl: "/settings",
        priority: "medium",
        createdAt: Date.now(),
      });
    }
    
    return pendingActions;
  },
});
