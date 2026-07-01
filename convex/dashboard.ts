import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

interface PendingAction {
  _id: string;
  title: string;
  description: string;
  actionUrl?: string;
  actionLabel?: string;
  priority: "low" | "medium" | "high";
  createdAt: number;
}

/**
 * Get pending actions for the current user
 * 
 * Checks user's availability status and other conditions to determine
 * what actions need to be taken.
 */
// @deprecated Use api.actionCentre.getMyActions instead. Kept until the new frontend ships.
export const getPendingActions = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.string(),
      title: v.string(),
      description: v.string(),
      actionUrl: v.optional(v.string()),
      actionLabel: v.optional(v.string()),
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
    
    // Check if the user needs to update their availability status
    // Simply check if they have a currentStatus set, regardless of when it was updated
    if (!user.currentStatus) {
      pendingActions.push({
        _id: "update-availability",
        title: "No Availability Status Set",
        description: "Your availability status needs to be updated, it is currently not set.",
        actionUrl: "/availability",
        actionLabel: "Update Availability",
        priority: "high",
        createdAt: Date.now(),
      });
    }
    
    // Check if the user has updated their skills
    if (!user.skills || user.skills.length === 0) {
      pendingActions.push({
        _id: "update-skills",
        title: "No Skills Set",
        description: "Please update your skills in the User Settings.",
        actionUrl: "/settings",
        actionLabel: "Update Skills",
        priority: "medium",
        createdAt: Date.now(),
      });
    }
    
    // Check for pending booking approvals
    // Get all resources where the current user is an approver
    const resources = await ctx.db.query("bookingResources").collect();
    const myResourceIds = resources
      .filter((resource) => resource.approvers.includes(userId))
      .map((resource) => resource._id);

    if (myResourceIds.length > 0) {
      // Get all pending bookings for those resources
      const allPendingBookings = await ctx.db
        .query("bookings")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();

      const myPendingBookings = allPendingBookings.filter((booking) =>
        myResourceIds.includes(booking.resourceId)
      );

      if (myPendingBookings.length > 0) {
        pendingActions.push({
          _id: "pending-booking-approvals",
          title: "You have bookings awaiting approval",
          description: `You have ${myPendingBookings.length} booking request${myPendingBookings.length > 1 ? 's' : ''} that need${myPendingBookings.length === 1 ? 's' : ''} your review.`,
          actionUrl: "/bookings",
          actionLabel: "Review Bookings",
          priority: "high",
          createdAt: Math.min(...myPendingBookings.map(b => b.createdAt)),
        });
      }
    }
    
    return pendingActions;
  },
});
