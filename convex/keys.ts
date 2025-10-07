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

    // Get key items count for each key
    const keysWithItemCount = await Promise.all(
      results.map(async (key) => {
        const keyItems = await ctx.db
          .query("keyItems")
          .withIndex("by_keyId", (q) => q.eq("keyId", key._id))
          .collect();
        
        return {
          ...key,
          itemCount: keyItems.length,
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

    // Update the key
    await ctx.db.patch(args.id, {
      pegNumber: args.pegNumber,
      siteName: args.siteName,
      address: args.address,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      contactPhone: args.contactPhone,
      notes: args.notes,
      updatedAt: Date.now(),
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
