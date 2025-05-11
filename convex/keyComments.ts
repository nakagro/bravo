import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get all comments for a specific key
 */
export const list = query({
  args: {
    keyId: v.id("keys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get comments for this key, ordered by timestamp (newest first)
    const comments = await ctx.db
      .query("keyComments")
      .withIndex("by_key", (q) => q.eq("keyId", args.keyId))
      .order("desc")
      .collect();

    // Get user information for each comment
    const userIds = [...new Set(comments.map(comment => comment.userId))];
    const usersData = await Promise.all(
      userIds.map(id => ctx.db.get(id))
    );
    
    // Create a map of user IDs to user data
    const userMap: Record<string, any> = {};
    for (let i = 0; i < userIds.length; i++) {
      const userData = usersData[i];
      if (userData) {
        userMap[userIds[i]] = userData;
      }
    }

    // Enrich comments with user information
    return comments.map(comment => {
      const userData = userMap[comment.userId];
      
      // Determine the user display name
      let displayName = "Unknown User";
      if (userData) {
        if (userData.name) {
          displayName = userData.name;
        } else if (userData.email) {
          displayName = userData.email;
        } else if (userData.tokenIdentifier) {
          displayName = "Anonymous User";
        }
      }
      
      return {
        _id: comment._id,
        _creationTime: comment._creationTime,
        keyId: comment.keyId,
        timestamp: comment.timestamp,
        text: comment.text,
        user: {
          _id: comment.userId,
          name: displayName,
          email: userData?.email || null,
        },
      };
    });
  },
  returns: v.array(
    v.object({
      _id: v.id("keyComments"),
      _creationTime: v.number(),
      keyId: v.id("keys"),
      timestamp: v.number(),
      text: v.string(),
      user: v.object({
        _id: v.id("users"),
        name: v.string(),
        email: v.union(v.string(), v.null()),
      }),
    })
  ),
});

/**
 * Add a new comment to a key
 */
export const add = mutation({
  args: {
    keyId: v.id("keys"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Validate that the key exists
    const key = await ctx.db.get(args.keyId);
    if (!key) throw new Error("Key not found");

    // Create the comment
    const commentId = await ctx.db.insert("keyComments", {
      keyId: args.keyId,
      userId,
      timestamp: Date.now(),
      text: args.text,
    });

    return commentId;
  },
  returns: v.id("keyComments"),
});

/**
 * Delete a comment
 * Any authenticated user can delete any comment
 */
export const remove = mutation({
  args: {
    commentId: v.id("keyComments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the comment
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Delete the comment - any authenticated user can delete any comment
    await ctx.db.delete(args.commentId);
    
    return null;
  },
  returns: v.null(),
});
