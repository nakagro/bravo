import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get all key items for a specific key
 */
export const list = query({
  args: {
    keyId: v.id("keys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const keyItems = await ctx.db
      .query("keyItems")
      .withIndex("by_keyId", (q) => q.eq("keyId", args.keyId))
      .collect();

    return keyItems;
  },
  returns: v.array(
    v.object({
      _id: v.id("keyItems"),
      _creationTime: v.number(),
      keyId: v.id("keys"),
      type: v.union(
        v.literal("Key"),
        v.literal("Fob"),
        v.literal("Swipe"),
        v.literal("Code")
      ),
      description: v.string(),
      createdBy: v.id("users"),
      updatedAt: v.number(),
    })
  ),
});

/**
 * Add a new key item
 */
export const add = mutation({
  args: {
    keyId: v.id("keys"),
    type: v.union(
      v.literal("Key"),
      v.literal("Fob"),
      v.literal("Swipe"),
      v.literal("Code")
    ),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Validate that the key exists
    const key = await ctx.db.get(args.keyId);
    if (!key) throw new Error("Key not found");

    const keyItemId = await ctx.db.insert("keyItems", {
      keyId: args.keyId,
      type: args.type,
      description: args.description,
      createdBy: userId,
      updatedAt: Date.now(),
    });

    return keyItemId;
  },
  returns: v.id("keyItems"),
});

/**
 * Update an existing key item
 */
export const update = mutation({
  args: {
    id: v.id("keyItems"),
    type: v.union(
      v.literal("Key"),
      v.literal("Fob"),
      v.literal("Swipe"),
      v.literal("Code")
    ),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the current key item data
    const keyItem = await ctx.db.get(args.id);
    if (!keyItem) throw new Error("Key item not found");

    // Update the key item
    await ctx.db.patch(args.id, {
      type: args.type,
      description: args.description,
      updatedAt: Date.now(),
    });

    return null;
  },
  returns: v.null(),
});

/**
 * Delete a key item
 */
export const remove = mutation({
  args: {
    id: v.id("keyItems"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the key item
    const keyItem = await ctx.db.get(args.id);
    if (!keyItem) throw new Error("Key item not found");

    // Delete the key item
    await ctx.db.delete(args.id);
    
    return null;
  },
  returns: v.null(),
});
