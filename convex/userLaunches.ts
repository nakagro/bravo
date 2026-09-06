import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

/** Skip the write if this device already reported within the hour. */
const MIN_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Called once per app session by the signed-in client. Records how BRAVO was
 * opened on this device so admins can see who is still on a phone browser tab.
 */
export const recordLaunch = mutation({
  args: {
    deviceId: v.string(),
    platform: v.string(),
    displayMode: v.union(v.literal("installed"), v.literal("browser")),
    deviceClass: v.union(v.literal("phone"), v.literal("desktop")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    if (args.deviceId.length === 0 || args.deviceId.length > 64) return null;

    const now = Date.now();
    const existing = await ctx.db
      .query("userLaunches")
      .withIndex("by_user_and_device", (q) =>
        q.eq("userId", userId).eq("deviceId", args.deviceId),
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("userLaunches", {
        userId,
        deviceId: args.deviceId,
        platform: args.platform,
        displayMode: args.displayMode,
        deviceClass: args.deviceClass,
        launchCount: 1,
        firstLaunchAt: now,
        lastLaunchAt: now,
      });
      return null;
    }

    const modeChanged =
      existing.displayMode !== args.displayMode || existing.platform !== args.platform;
    if (!modeChanged && now - existing.lastLaunchAt < MIN_INTERVAL_MS) return null;

    await ctx.db.patch(existing._id, {
      platform: args.platform,
      displayMode: args.displayMode,
      deviceClass: args.deviceClass,
      launchCount: existing.launchCount + 1,
      lastLaunchAt: now,
    });
    return null;
  },
});
