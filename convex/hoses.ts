import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    status: v.optional(v.union(
      v.literal("With district for repair"),
      v.literal("Condemned"),
      v.literal("Due for testing"),
      v.literal("In date")
    )),
    size: v.optional(v.union(v.literal("25"), v.literal("38"), v.literal("65"))),
    type: v.optional(v.union(v.literal("Canvas"), v.literal("Duraline"))),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let query = ctx.db.query("hoses");
    let results = await query.collect();

    if (args.status) {
      results = results.filter(hose => hose.status === args.status);
    }
    if (args.size) {
      results = results.filter(hose => hose.size === args.size);
    }
    if (args.type) {
      results = results.filter(hose => hose.type === args.type);
    }
    if (args.search && args.search.trim() !== '') {
      const searchTerm = args.search.toLowerCase();
      results = results.filter(hose => 
        hose.hoseId.toLowerCase().includes(searchTerm)
      );
    }

    return results.sort((a, b) => {
      const statusPriority: { [key: string]: number } = {
        "Condemned": 0,
        "Due for testing": 1,
        "With district for repair": 2,
        "In date": 3,
      };
      return statusPriority[a.status] - statusPriority[b.status];
    });
  },
});

export const add = mutation({
  args: {
    hoseId: v.string(),
    length: v.number(),
    size: v.union(v.literal("25"), v.literal("38"), v.literal("65")),
    type: v.union(v.literal("Canvas"), v.literal("Duraline")),
    testDate: v.number(),
    status: v.union(
      v.literal("With district for repair"),
      v.literal("Condemned"),
      v.literal("Due for testing"),
      v.literal("In date")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("hoses")
      .withIndex("by_hoseId", q => q.eq("hoseId", args.hoseId))
      .unique();
    
    if (existing) {
      throw new Error("Hose ID already exists");
    }

    await ctx.db.insert("hoses", {
      ...args,
      createdBy: userId,
      updatedAt: Date.now(),
    });
  },
});

export const getHistory = query({
  args: {
    hoseId: v.id("hoses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the history records for this hose
    const history = await ctx.db
      .query("hoseHistory")
      .withIndex("by_hose", (q) => q.eq("hoseId", args.hoseId))
      .order("desc")
      .collect();

    // Get user information for each history entry
    const userIds = [...new Set(history.map(entry => entry.userId))];
    const usersData = await Promise.all(
      userIds.map(id => ctx.db.get(id))
    );
    
    // Create a map of user IDs to user data, filtering out null values
    const userMap: Record<string, any> = {};
    for (let i = 0; i < userIds.length; i++) {
      const userData = usersData[i];
      if (userData) {
        userMap[userIds[i]] = userData;
      }
    }

    // Enrich history with user information
    return history.map(entry => {
      const userData = userMap[entry.userId];
      
      // Determine the user display name
      let displayName = "Unknown User";
      if (userData) {
        if (userData.name) {
          // Use the user's name if available
          displayName = userData.name;
        } else if (userData.email) {
          // Use email if name is not available
          displayName = userData.email;
        } else if (userData.tokenIdentifier) {
          // For anonymous users, indicate that
          displayName = "Anonymous User";
        }
      }
      
      return {
        _id: entry._id,
        hoseId: entry.hoseId,
        timestamp: entry.timestamp,
        userId: entry.userId,
        changeType: entry.changeType,
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        notes: entry.notes,
        user: {
          name: displayName,
          email: userData?.email || null,
        },
      };
    });
  },
  returns: v.array(
    v.object({
      _id: v.id("hoseHistory"),
      hoseId: v.id("hoses"),
      timestamp: v.number(),
      userId: v.id("users"),
      changeType: v.string(),
      field: v.string(),
      oldValue: v.any(),
      newValue: v.any(),
      notes: v.optional(v.string()),
      user: v.object({
        name: v.string(),
        email: v.union(v.string(), v.null()),
      }),
    })
  ),
});

export const markAsReplaced = mutation({
  args: {
    id: v.id("hoses"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the current hose data
    const hose = await ctx.db.get(args.id);
    if (!hose) throw new Error("Hose not found");

    const timestamp = Date.now();
    
    // Record the replacement in the history
    await ctx.db.insert("hoseHistory", {
      hoseId: args.id,
      timestamp,
      userId,
      changeType: "hose_replacement",
      field: "replacement",
      oldValue: "original",
      newValue: "replaced",
      notes: args.notes || "Hose was replaced",
    });
    
    // Update the hose with the replacement timestamp
    await ctx.db.patch(args.id, { 
      replacedAt: timestamp,
      updatedAt: timestamp 
    });
    
    return null;
  },
  returns: v.null(),
});

/**
 * Delete a hose and its related data
 */
export const deleteHose = mutation({
  args: {
    id: v.id("hoses"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the hose
    const hose = await ctx.db.get(args.id);
    if (!hose) throw new Error("Hose not found");
    
    // Get all comments for this hose
    const comments = await ctx.db
      .query("hoseComments")
      .withIndex("by_hose", q => q.eq("hoseId", args.id))
      .collect();
    
    // Delete all comments
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }
    
    // Create a final history entry recording the deletion
    await ctx.db.insert("hoseHistory", {
      hoseId: args.id,
      timestamp: Date.now(),
      userId,
      changeType: "hose_deletion",
      field: "deleted",
      oldValue: hose.hoseId,
      newValue: null,
      notes: args.reason || "Hose deleted",
    });
    
    // Delete the hose
    await ctx.db.delete(args.id);
    
    return null;
  },
  returns: v.null(),
});

export const update = mutation({
  args: {
    id: v.id("hoses"),
    length: v.optional(v.number()),
    size: v.optional(v.union(v.literal("25"), v.literal("38"), v.literal("65"))),
    type: v.optional(v.union(v.literal("Canvas"), v.literal("Duraline"))),
    testDate: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("With district for repair"),
      v.literal("Condemned"),
      v.literal("Due for testing"),
      v.literal("In date")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    
    // Get the current hose data to compare with updates
    const currentHose = await ctx.db.get(id);
    if (!currentHose) throw new Error("Hose not found");
    
    // Record history for each changed field
    const timestamp = Date.now();
    for (const [field, newValue] of Object.entries(updates)) {
      // Type-safe way to check if the field exists and values differ
      if (field in currentHose) {
        // Use type assertion for TypeScript
        const oldValue = (currentHose as Record<string, any>)[field];
        if (oldValue !== newValue) {
          await ctx.db.insert("hoseHistory", {
            hoseId: id,
            timestamp,
            userId,
            changeType: `${field}_change`,
            field,
            oldValue,
            newValue,
          });
        }
      }
    }
    
    // Update the hose
    await ctx.db.patch(id, { ...updates, updatedAt: timestamp });
  },
  returns: v.null(),
});
