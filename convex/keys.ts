import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * List all keys with optional filtering
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let query = ctx.db.query("keys");
    let results = await query.collect();

    if (args.search && args.search.trim() !== '') {
      const searchTerm = args.search.toLowerCase();
      results = results.filter(key => 
        key.pegNumber.toLowerCase().includes(searchTerm) ||
        key.siteName.toLowerCase().includes(searchTerm) ||
        key.address.toLowerCase().includes(searchTerm)
      );
    }

    // Get key items count and type summary for each key
    const keysWithItemCount = await Promise.all(
      results.map(async (key) => {
        const keyItems = await ctx.db
          .query("keyItems")
          .withIndex("by_keyId", (q) => q.eq("keyId", key._id))
          .collect();

        // Build type summary (e.g., "2 Keys, 1 Fob")
        const typeCounts: Record<string, number> = {};
        for (const item of keyItems) {
          typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
        }
        const itemSummary = Object.entries(typeCounts)
          .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
          .join(', ');

        return {
          ...key,
          itemCount: keyItems.length,
          itemSummary,
        };
      })
    );

    return keysWithItemCount.sort((a, b) => a.pegNumber.localeCompare(b.pegNumber));
  },
  returns: v.array(
    v.object({
      _id: v.id("keys"),
      _creationTime: v.number(),
      pegNumber: v.string(),
      siteName: v.string(),
      address: v.string(),
      contactName: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      updatedAt: v.number(),
      itemCount: v.number(),
      itemSummary: v.string(),
    })
  ),
});

/**
 * Get a single key by ID
 */
export const get = query({
  args: {
    id: v.id("keys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const key = await ctx.db.get(args.id);
    if (!key) throw new Error("Key not found");

    return key;
  },
  returns: v.object({
    _id: v.id("keys"),
    _creationTime: v.number(),
    pegNumber: v.string(),
    siteName: v.string(),
    address: v.string(),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  }),
});

/**
 * Add a new key
 */
export const add = mutation({
  args: {
    pegNumber: v.string(),
    siteName: v.string(),
    address: v.string(),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if a key with this peg number already exists
    const existing = await ctx.db
      .query("keys")
      .withIndex("by_pegNumber", q => q.eq("pegNumber", args.pegNumber))
      .unique();
    
    if (existing) {
      throw new Error("Peg number already exists");
    }

    const keyId = await ctx.db.insert("keys", {
      ...args,
      createdBy: userId,
      updatedAt: Date.now(),
    });

    return keyId;
  },
  returns: v.id("keys"),
});

/**
 * Update an existing key
 */
export const update = mutation({
  args: {
    id: v.id("keys"),
    pegNumber: v.string(),
    siteName: v.string(),
    address: v.string(),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the current key data
    const key = await ctx.db.get(args.id);
    if (!key) throw new Error("Key not found");

    // Check if another key with this peg number already exists (but not this one)
    if (key.pegNumber !== args.pegNumber) {
      const existing = await ctx.db
        .query("keys")
        .withIndex("by_pegNumber", q => q.eq("pegNumber", args.pegNumber))
        .unique();
      
      if (existing) {
        throw new Error("Peg number already exists");
      }
    }

    const timestamp = Date.now();
    
    // Track changes for history
    const fieldsToTrack = [
      'pegNumber', 'siteName', 'address', 'contactName', 
      'contactEmail', 'contactPhone', 'notes'
    ];
    
    for (const field of fieldsToTrack) {
      const oldValue = (key as any)[field];
      const newValue = (args as any)[field];
      
      if (oldValue !== newValue) {
        await ctx.db.insert("keyHistory", {
          keyId: args.id,
          timestamp,
          userId,
          changeType: "field_change",
          field,
          oldValue: oldValue || "",
          newValue: newValue || "",
        });
      }
    }

    // Update the key
    await ctx.db.patch(args.id, {
      pegNumber: args.pegNumber,
      siteName: args.siteName,
      address: args.address,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      contactPhone: args.contactPhone,
      notes: args.notes,
      updatedAt: timestamp,
    });

    return null;
  },
  returns: v.null(),
});

/**
 * Delete a key and its related data
 */
export const remove = mutation({
  args: {
    id: v.id("keys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the key
    const key = await ctx.db.get(args.id);
    if (!key) throw new Error("Key not found");

    // Record deletion in history
    await ctx.db.insert("keyHistory", {
      keyId: args.id,
      timestamp: Date.now(),
      userId,
      changeType: "key_deleted",
      field: "deleted",
      oldValue: key.pegNumber,
      newValue: "deleted",
      notes: `Key ${key.pegNumber} (${key.siteName}) was deleted`,
    });

    // Delete all key items for this key
    const keyItems = await ctx.db
      .query("keyItems")
      .withIndex("by_keyId", q => q.eq("keyId", args.id))
      .collect();
    
    for (const item of keyItems) {
      await ctx.db.delete(item._id);
    }

    // Delete all comments for this key
    const comments = await ctx.db
      .query("keyComments")
      .withIndex("by_key", q => q.eq("keyId", args.id))
      .collect();
    
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete the key
    await ctx.db.delete(args.id);
    
    return null;
  },
  returns: v.null(),
});

/**
 * Get history for a specific key
 */
export const getHistory = query({
  args: {
    keyId: v.id("keys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the history records for this key
    const history = await ctx.db
      .query("keyHistory")
      .withIndex("by_key", (q) => q.eq("keyId", args.keyId))
      .order("desc")
      .collect();

    // Enrich with user information
    const enrichedHistory = await Promise.all(
      history.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          ...entry,
          user: {
            name: user?.name || "Unknown User",
            email: user?.email,
          },
        };
      })
    );

    return enrichedHistory;
  },
  returns: v.array(
    v.object({
      _id: v.id("keyHistory"),
      _creationTime: v.number(),
      keyId: v.id("keys"),
      timestamp: v.number(),
      userId: v.id("users"),
      changeType: v.string(),
      field: v.string(),
      oldValue: v.any(),
      newValue: v.any(),
      notes: v.optional(v.string()),
      user: v.object({
        name: v.string(),
        email: v.optional(v.string()),
      }),
    })
  ),
});
