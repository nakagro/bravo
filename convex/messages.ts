import { mutation, query, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Get current user ID (for checking message ownership)
export const getCurrentUserId = query({
  args: {},
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId;
  },
});

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

// Get all availability messages, sorted by timestamp (newest first)
// Messages are automatically deleted at 4am daily by cron job
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
    // Get all messages, ordered by timestamp (newest first)
    const messages = await ctx.db
      .query("availabilityMessages")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    // For each message, get the user information and format the response
    const messagesWithUserInfo = await Promise.all(
      messages.map(async (message) => {
        const user = await ctx.db.get(message.userId);
        
        // Handle case where user might be null
        if (!user) {
          return {
            _id: message._id,
            userId: message.userId,
            message: message.message,
            timestamp: message.timestamp,
            user: {
              _id: message.userId,
              name: "Unknown User",
              firstName: undefined,
              lastName: undefined,
            },
          };
        }
        
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
// Messages are automatically deleted at 4am daily by cron job
export const getUnreadMessageCount = query({
  args: {
    lastViewedAt: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Count messages posted after the user's last viewed timestamp
    const messages = await ctx.db
      .query("availabilityMessages")
      .withIndex("by_timestamp")
      .filter((q) => q.gt(q.field("timestamp"), args.lastViewedAt))
      .collect();
    
    return messages.length;
  },
});

// Update a message (only the message author can update within 10 minutes)
export const updateMessage = mutation({
  args: {
    messageId: v.id("availabilityMessages"),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update a message");
    }

    // Get the message to verify ownership
    const existingMessage = await ctx.db.get(args.messageId);
    if (!existingMessage) {
      throw new Error("Message not found");
    }

    // Verify the user owns this message
    if (existingMessage.userId !== userId) {
      throw new Error("You can only update your own messages");
    }

    // Check if message is within 10-minute edit window
    const tenMinutesInMs = 10 * 60 * 1000;
    const messageAge = Date.now() - existingMessage.timestamp;
    if (messageAge > tenMinutesInMs) {
      throw new Error("Messages can only be edited within 10 minutes of posting");
    }

    // Update the message
    await ctx.db.patch(args.messageId, {
      message: args.message,
      timestamp: Date.now(), // Update timestamp to reflect edit
    });

    return null;
  },
});

// Delete a message (only the message author can delete within 10 minutes)
export const deleteMessage = mutation({
  args: {
    messageId: v.id("availabilityMessages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to delete a message");
    }

    // Get the message to verify ownership
    const existingMessage = await ctx.db.get(args.messageId);
    if (!existingMessage) {
      throw new Error("Message not found");
    }

    // Verify the user owns this message
    if (existingMessage.userId !== userId) {
      throw new Error("You can only delete your own messages");
    }

    // Check if message is within 10-minute delete window
    const tenMinutesInMs = 10 * 60 * 1000;
    const messageAge = Date.now() - existingMessage.timestamp;
    if (messageAge > tenMinutesInMs) {
      throw new Error("Messages can only be deleted within 10 minutes of posting");
    }

    // Delete the message
    await ctx.db.delete(args.messageId);

    return null;
  },
});

// Internal mutation to delete all messages (called by cron job at 4am)
export const deleteAllMessages = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    // Get all messages
    const messages = await ctx.db.query("availabilityMessages").collect();
    
    // Delete each message
    await Promise.all(messages.map((message) => ctx.db.delete(message._id)));
    
    console.log(`Deleted ${messages.length} messages at ${new Date().toISOString()}`);
    
    return messages.length;
  },
});

// Action wrapper for manual deletion of all messages (for admin use)
export const deleteAllMessagesAction = action({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const count: number = await ctx.runMutation(internal.messages.deleteAllMessages);
    return count;
  },
});
