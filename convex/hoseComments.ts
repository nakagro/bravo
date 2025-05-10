import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get all comments for a specific hose
 */
export const list = query({
  args: {
    hoseId: v.id("hoses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get comments for this hose, ordered by timestamp (newest first)
    const comments = await ctx.db
      .query("hoseComments")
      .withIndex("by_hose", (q) => q.eq("hoseId", args.hoseId))
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
        hoseId: comment.hoseId,
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
      _id: v.id("hoseComments"),
      hoseId: v.id("hoses"),
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
 * Add a new comment to a hose
 */
export const add = mutation({
  args: {
    hoseId: v.id("hoses"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Validate that the hose exists
    const hose = await ctx.db.get(args.hoseId);
    if (!hose) throw new Error("Hose not found");

    // Create the comment
    const commentId = await ctx.db.insert("hoseComments", {
      hoseId: args.hoseId,
      userId,
      timestamp: Date.now(),
      text: args.text,
    });

    return commentId;
  },
  returns: v.id("hoseComments"),
});

/**
 * Delete a comment
 * Any authenticated user can delete any comment
 */
export const remove = mutation({
  args: {
    commentId: v.id("hoseComments"),
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
