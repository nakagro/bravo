import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get all email settings
 */
export const getEmailSettings = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("emailSettings"),
      _creationTime: v.number(),
      emailType: v.union(v.literal("newUserSignup")),
      enabled: v.boolean(),
      description: v.string(),
      updatedBy: v.id("users"),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("emailSettings").collect();
  },
});

/**
 * Get a specific email setting by type
 */
export const getEmailSetting = query({
  args: {
    emailType: v.union(v.literal("newUserSignup")),
  },
  returns: v.union(
    v.object({
      _id: v.id("emailSettings"),
      _creationTime: v.number(),
      emailType: v.union(v.literal("newUserSignup")),
      enabled: v.boolean(),
      description: v.string(),
      updatedBy: v.id("users"),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailSettings")
      .withIndex("by_emailType", (q) => q.eq("emailType", args.emailType))
      .first();
  },
});

/**
 * Update an email setting (admin only)
 */
export const updateEmailSetting = mutation({
  args: {
    emailType: v.union(v.literal("newUserSignup")),
    enabled: v.boolean(),
  },
  returns: v.id("emailSettings"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update email settings");
    }

    // Check if user is admin
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new Error("Only administrators can update email settings");
    }

    // Find existing setting
    const existingSetting = await ctx.db
      .query("emailSettings")
      .withIndex("by_emailType", (q) => q.eq("emailType", args.emailType))
      .first();

    if (existingSetting) {
      // Update existing setting
      await ctx.db.patch(existingSetting._id, {
        enabled: args.enabled,
        updatedBy: userId,
        updatedAt: Date.now(),
      });
      return existingSetting._id;
    } else {
      // Create new setting if it doesn't exist
      const descriptions = {
        newUserSignup: "Send email notification to admins when a new user signs up",
      };

      return await ctx.db.insert("emailSettings", {
        emailType: args.emailType,
        enabled: args.enabled,
        description: descriptions[args.emailType],
        updatedBy: userId,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Initialize default email settings
 */
export const initializeEmailSettings = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to initialize email settings");
    }

    // Check if user is admin
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new Error("Only administrators can initialize email settings");
    }

    const emailTypes = [
      {
        emailType: "newUserSignup" as const,
        description: "Send email notification to admins when a new user signs up",
        enabled: true,
      },
    ];

    for (const emailType of emailTypes) {
      const existing = await ctx.db
        .query("emailSettings")
        .withIndex("by_emailType", (q) => q.eq("emailType", emailType.emailType))
        .first();

      if (!existing) {
        await ctx.db.insert("emailSettings", {
          emailType: emailType.emailType,
          enabled: emailType.enabled,
          description: emailType.description,
          updatedBy: userId,
          updatedAt: Date.now(),
        });
      }
    }

    return null;
  },
});
