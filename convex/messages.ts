import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Post a new availability message
export const postMessage = mutation({
  args: {
    message: v.string(),
  },
  returns: v.id("availabilityMessages"),
  handler: async (ctx, args) => {
    // Get the authenticated user ID using the same pattern as other mutations
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to post a message");
    }
    
    // Get the current user data directly using the ID
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Create the new message
    return await ctx.db.insert("availabilityMessages", {
      userId: userId,
      message: args.message,
      timestamp: Date.now(),
    });
  },
});

// Get all availability messages from the current day (starting at 4am), sorted by timestamp (newest first)
export const getMessages = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("availabilityMessages"),
      userId: v.id("users"),
      message: v.string(),
      timestamp: v.number(),
      user: v.object({
        _id: v.id("users"),
        name: v.optional(v.string()),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
      }),
    })
  ),
  handler: async (ctx) => {
    // Calculate the timestamp for 4am of the current day
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
    
    // Get messages since the cutoff time, ordered by timestamp (newest first)
    const messages = await ctx.db
      .query("availabilityMessages")
      .withIndex("by_timestamp")
      .filter((q) => q.gte(q.field("timestamp"), cutoffTime))
      .order("desc")
      .collect();

    // For each message, get the user information and format the response
    const messagesWithUserInfo = await Promise.all(
      messages.map(async (message) => {
        const user = await ctx.db.get(message.userId);
        
        // Handle case where user might be null
        if (!user) {
          // Create a properly formatted response object with only the fields we've defined in the validator
          return {
            _id: message._id,
            userId: message.userId,
            message: message.message,
            timestamp: message.timestamp,
            user: {
              _id: message.userId, // Use the userId as a fallback
              name: "Unknown User",
              firstName: undefined,
              lastName: undefined,
            },
          };
        }
        
        // Create a properly formatted response object with only the fields we've defined in the validator
        return {
          _id: message._id,
          userId: message.userId,
          message: message.message,
          timestamp: message.timestamp,
          user: {
            _id: user._id,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        };
      })
    );

    return messagesWithUserInfo;
  },
});

// Get count of messages after a specific timestamp (for unread message count)
export const getUnreadMessageCount = query({
  args: {
    lastViewedAt: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Calculate the timestamp for 4am of the current day (same logic as getMessages)
    const now = new Date();
    const today4am = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      4,
      0,
      0,
      0
    ).getTime();
    
    const cutoffTime = now.getHours() < 4 ? 
      today4am - 24 * 60 * 60 * 1000 : 
      today4am;
    
    // Count messages that are:
    // 1. After the cutoff time (within the daily window)
    // 2. After the user's last viewed timestamp
    const effectiveTimestamp = Math.max(cutoffTime, args.lastViewedAt);
    
    const messages = await ctx.db
      .query("availabilityMessages")
      .withIndex("by_timestamp")
      .filter((q) => q.gt(q.field("timestamp"), effectiveTimestamp))
      .collect();
    
    return messages.length;
  },
});
