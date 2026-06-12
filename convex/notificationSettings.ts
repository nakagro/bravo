import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get all notification settings
export const getNotificationSettings = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("notificationSettings"),
    _creationTime: v.number(),
    notificationType: v.union(
      v.literal("nightlyReset"),
      v.literal("morningReminder"),
      v.literal("eventReminder")
    ),
    enabled: v.boolean(),
    description: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.number()
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new Error("Admin access required");
    }

    return await ctx.db.query("notificationSettings").collect();
  },
});

// Get a specific notification setting
export const getNotificationSetting = query({
  args: { notificationType: v.union(v.literal("nightlyReset"), v.literal("morningReminder"), v.literal("eventReminder")) },
  returns: v.union(v.object({
    _id: v.id("notificationSettings"),
    _creationTime: v.number(),
    notificationType: v.union(
      v.literal("nightlyReset"),
      v.literal("morningReminder"),
      v.literal("eventReminder")
    ),
    enabled: v.boolean(),
    description: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.number()
  }), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notificationSettings")
      .withIndex("by_notificationType", (q) => q.eq("notificationType", args.notificationType))
      .first();
  },
});

// Initialize default notification settings (run once)
export const initializeNotificationSettings = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new Error("Admin access required");
    }

    const defaultSettings = [
      {
        notificationType: "nightlyReset" as const,
        enabled: true,
        description: "Daily status reset notifications sent at 4:00 AM",
      },
      {
        notificationType: "morningReminder" as const,
        enabled: true,
        description: "Morning reminder notifications sent at 10:00 AM",
      },
      {
        notificationType: "eventReminder" as const,
        // Off by default — must be explicitly enabled in Admin → Notification
        // Settings before the cron sends anything
        enabled: false,
        description: "Reminder the evening before brigade events, sent at 6:00 PM",
      },
    ];

    let created = 0;
    for (const setting of defaultSettings) {
      // Check if setting already exists
      const existing = await ctx.db
        .query("notificationSettings")
        .withIndex("by_notificationType", (q) => q.eq("notificationType", setting.notificationType))
        .first();

      if (!existing) {
        await ctx.db.insert("notificationSettings", {
          ...setting,
          updatedBy: userId,
          updatedAt: Date.now(),
        });
        created++;
      }
    }

    return created;
  },
});

// Update notification setting
export const updateNotificationSetting = mutation({
  args: {
    notificationType: v.union(v.literal("nightlyReset"), v.literal("morningReminder"), v.literal("eventReminder")),
    enabled: v.boolean(),
  },
  returns: v.id("notificationSettings"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new Error("Admin access required");
    }

    // Find existing setting
    const existing = await ctx.db
      .query("notificationSettings")
      .withIndex("by_notificationType", (q) => q.eq("notificationType", args.notificationType))
      .first();

    if (existing) {
      // Update existing setting
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        updatedBy: userId,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new setting if it doesn't exist
      const description = args.notificationType === "nightlyReset"
        ? "Daily status reset notifications sent at 4:00 AM"
        : args.notificationType === "eventReminder"
          ? "Reminder the evening before brigade events, sent at 6:00 PM"
          : "Morning reminder notifications sent at 10:00 AM";
      
      return await ctx.db.insert("notificationSettings", {
        notificationType: args.notificationType,
        enabled: args.enabled,
        description,
        updatedBy: userId,
        updatedAt: Date.now(),
      });
    }
  },
});

// Helper function to check if a notification type is enabled (used by scheduled actions)
export const isNotificationEnabled = query({
  args: { notificationType: v.union(v.literal("nightlyReset"), v.literal("morningReminder"), v.literal("eventReminder")) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("notificationSettings")
      .withIndex("by_notificationType", (q) => q.eq("notificationType", args.notificationType))
      .first();

    // If no setting row exists yet: legacy types default to enabled
    // (preserves existing behaviour), but event reminders are opt-in and
    // stay off until explicitly enabled in the admin UI
    return setting?.enabled ?? (args.notificationType !== "eventReminder");
  },
});
