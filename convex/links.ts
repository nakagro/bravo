import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getActiveLinks = query({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db
      .query("links")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();
    // sort by order ascending then title
    return links.sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title));
  },
});

export const getAllLinks = query({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db.query("links").collect();
    return links.sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title));
  },
});

export const createLink = mutation({
  args: {
    title: v.string(),
    url: v.string(),
    category: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const now = Date.now();
    const id = await ctx.db.insert("links", {
      ...args,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const updateLink = mutation({
  args: {
    id: v.id("links"),
    title: v.optional(v.string()),
    url: v.optional(v.string()),
    category: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const { id, ...patch } = args;
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
    return true;
  },
});

export const deleteLink = mutation({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.delete(id);
    return true;
  },
});
