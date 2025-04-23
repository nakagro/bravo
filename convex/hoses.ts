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
    if (args.search) {
      results = results.filter(hose => hose.hoseId === args.search);
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
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});
