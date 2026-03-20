import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

async function ensureCategoryExists(ctx: any, userId: any, category: string | undefined) {
  const normalized = category?.trim();
  if (!normalized) {
    return;
  }

  const existing = await ctx.db
    .query("linkCategories")
    .withIndex("by_name", (q: any) => q.eq("name", normalized))
    .unique();

  if (existing) {
    return existing;
  }

  const categories = await ctx.db.query("linkCategories").collect();
  const nextOrder = categories.length === 0
    ? 0
    : Math.max(...categories.map((item: any) => item.order ?? 0)) + 1;
  const now = Date.now();

  const id = await ctx.db.insert("linkCategories", {
    name: normalized,
    order: nextOrder,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  return await ctx.db.get(id);
}

async function getCategoryOrderMap(ctx: any) {
  const categories = await ctx.db.query("linkCategories").collect();
  return new Map<string, number>(
    categories.map((category: any) => [category.name, Number(category.order ?? 0)])
  );
}

export const getActiveLinks = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("links"),
    _creationTime: v.number(),
    title: v.string(),
    url: v.string(),
    category: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    categoryOrder: v.number(),
  })),
  handler: async (ctx) => {
    const links = await ctx.db
      .query("links")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();
    const categoryOrderMap = await getCategoryOrderMap(ctx);

    return links
      .map((link) => ({
        ...link,
        categoryOrder: Number(categoryOrderMap.get(link.category?.trim() || "") ?? Number.MAX_SAFE_INTEGER),
      }))
      .sort((a, b) => {
        if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
        const aCategory = a.category?.trim() || "";
        const bCategory = b.category?.trim() || "";
        if (aCategory !== bCategory) return aCategory.localeCompare(bCategory);
        return (a.order - b.order) || a.title.localeCompare(b.title);
      });
  },
});

export const getAllLinks = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("links"),
    _creationTime: v.number(),
    title: v.string(),
    url: v.string(),
    category: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    categoryOrder: v.number(),
  })),
  handler: async (ctx) => {
    const links = await ctx.db.query("links").collect();
    const categoryOrderMap = await getCategoryOrderMap(ctx);

    return links
      .map((link) => ({
        ...link,
        categoryOrder: Number(categoryOrderMap.get(link.category?.trim() || "") ?? Number.MAX_SAFE_INTEGER),
      }))
      .sort((a, b) => {
        if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
        const aCategory = a.category?.trim() || "";
        const bCategory = b.category?.trim() || "";
        if (aCategory !== bCategory) return aCategory.localeCompare(bCategory);
        return (a.order - b.order) || a.title.localeCompare(b.title);
      });
  },
});

export const getLinkCategories = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("linkCategories"),
    _creationTime: v.number(),
    name: v.string(),
    order: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    const categories = await ctx.db.query("linkCategories").collect();
    return categories.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
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
    await ensureCategoryExists(ctx, userId, args.category);
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
    if (patch.category !== undefined) {
      await ensureCategoryExists(ctx, userId, patch.category);
    }
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
    return true;
  },
});

export const reorderLinkCategories = mutation({
  args: {
    orderedCategoryNames: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    for (const name of args.orderedCategoryNames) {
      await ensureCategoryExists(ctx, userId, name);
    }

    const refreshedCategories = await ctx.db.query("linkCategories").collect();
    const refreshedMap = new Map(refreshedCategories.map((category) => [category.name, category]));

    for (const [index, name] of args.orderedCategoryNames.entries()) {
      const category = refreshedMap.get(name);
      if (!category) continue;
      await ctx.db.patch(category._id, {
        order: index,
        updatedAt: now,
      });
    }

    const remaining = refreshedCategories
      .filter((category) => !args.orderedCategoryNames.includes(category.name))
      .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));

    for (const [offset, category] of remaining.entries()) {
      await ctx.db.patch(category._id, {
        order: args.orderedCategoryNames.length + offset,
        updatedAt: now,
      });
    }

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
