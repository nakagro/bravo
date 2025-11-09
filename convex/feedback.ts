import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * Submit feedback from a user
 */
export const submitFeedback = mutation({
  args: {
    subject: v.string(),
    message: v.string(),
    category: v.union(
      v.literal("bug"),
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("general")
    ),
    isAnonymous: v.boolean(),
    appVersion: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    let submittedBy: Id<"users"> | undefined = undefined;
    let submitterName: string | undefined = undefined;
    
    // If not anonymous and user is authenticated, get user details
    if (!args.isAnonymous && userId) {
      const user = await ctx.db.get(userId);
      submittedBy = userId;
      submitterName = user?.firstName || user?.name || user?.email || "Unknown User";
    }
    
    // Insert feedback into database
    await ctx.db.insert("feedback", {
      subject: args.subject,
      message: args.message,
      category: args.category,
      isAnonymous: args.isAnonymous,
      submittedBy,
      submitterName,
      appVersion: args.appVersion,
      createdAt: Date.now(),
    });
    
    // Check if feedback email notifications are enabled
    const emailSetting = await ctx.db
      .query("emailSettings")
      .withIndex("by_emailType", (q) => q.eq("emailType", "feedbackSubmission"))
      .first();
    
    if (emailSetting?.enabled) {
      // Get all admin users with email addresses
      const allUsers = await ctx.db.query("users").collect();
      const adminEmails = allUsers
        .filter(user => user.isAdmin && user.email)
        .map(user => user.email as string);
      
      // Schedule email notification (don't await - let it run in background)
      if (adminEmails.length > 0) {
        await ctx.scheduler.runAfter(0, internal.emails.sendFeedbackNotification, {
          adminEmails,
          subject: args.subject,
          message: args.message,
          category: args.category,
          submitterName,
          isAnonymous: args.isAnonymous,
          appVersion: args.appVersion,
        });
      }
    }
    
    return null;
  },
});

/**
 * Get all feedback (admin only)
 */
export const getAllFeedback = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("feedback"),
    subject: v.string(),
    message: v.string(),
    category: v.union(
      v.literal("bug"),
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("general")
    ),
    isAnonymous: v.boolean(),
    submittedBy: v.optional(v.id("users")),
    submitterName: v.optional(v.string()),
    appVersion: v.string(),
    createdAt: v.number(),
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new Error("Admin access required");
    }
    
    return await ctx.db
      .query("feedback")
      .order("desc")
      .collect();
  },
});
