import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ============================================================================
// CATEGORY FUNCTIONS
// ============================================================================

/**
 * Get all active equipment categories
 */
export const getCategories = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("equipmentCategories"),
    _creationTime: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("equipmentCategories")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();
    return categories.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get all categories (including inactive) for admin
 */
export const getAllCategories = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("equipmentCategories"),
    _creationTime: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    order: v.number(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    const categories = await ctx.db.query("equipmentCategories").collect();
    return categories.sort((a, b) => a.order - b.order);
  },
});

/**
 * Create a new equipment category
 */
export const createCategory = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("equipmentCategories"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to create categories");
    }

    // Get the highest order number
    const categories = await ctx.db.query("equipmentCategories").collect();
    const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.order), 0);

    const now = Date.now();
    return await ctx.db.insert("equipmentCategories", {
      name: args.name,
      description: args.description,
      order: maxOrder + 1,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an equipment category
 */
export const updateCategory = mutation({
  args: {
    categoryId: v.id("equipmentCategories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    order: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update categories");
    }

    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    await ctx.db.patch(args.categoryId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.order !== undefined && { order: args.order }),
      ...(args.isActive !== undefined && { isActive: args.isActive }),
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Delete an equipment category (only if no items are associated)
 */
export const deleteCategory = mutation({
  args: {
    categoryId: v.id("equipmentCategories"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to delete categories");
    }

    // Check if any items are associated with this category
    const items = await ctx.db
      .query("equipmentItems")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .first();

    if (items) {
      throw new Error("Cannot delete category with associated items. Please move or delete items first.");
    }

    await ctx.db.delete(args.categoryId);
    return null;
  },
});

// ============================================================================
// ITEM FUNCTIONS
// ============================================================================

/**
 * Get all active equipment items with category info
 */
export const getItems = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("equipmentItems"),
    _creationTime: v.number(),
    name: v.string(),
    categoryId: v.id("equipmentCategories"),
    categoryName: v.string(),
    description: v.optional(v.string()),
    size: v.optional(v.string()),
    currentStock: v.number(),
    minimumStock: v.optional(v.number()),
    unit: v.optional(v.string()),
    isActive: v.boolean(),
    isLowStock: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    const items = await ctx.db
      .query("equipmentItems")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const categories = await ctx.db.query("equipmentCategories").collect();
    const categoryMap = new Map(categories.map((c) => [c._id, c]));

    return items.map((item) => {
      const category = categoryMap.get(item.categoryId);
      return {
        _id: item._id,
        _creationTime: item._creationTime,
        name: item.name,
        categoryId: item.categoryId,
        categoryName: category?.name ?? "Unknown",
        description: item.description,
        size: item.size,
        currentStock: item.currentStock,
        minimumStock: item.minimumStock,
        unit: item.unit,
        isActive: item.isActive,
        isLowStock: item.minimumStock !== undefined && item.currentStock <= item.minimumStock,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
  },
});

/**
 * Get items grouped by category for display
 */
export const getItemsByCategory = query({
  args: {},
  returns: v.array(v.object({
    category: v.object({
      _id: v.id("equipmentCategories"),
      name: v.string(),
      description: v.optional(v.string()),
      order: v.number(),
    }),
    items: v.array(v.object({
      _id: v.id("equipmentItems"),
      name: v.string(),
      description: v.optional(v.string()),
      size: v.optional(v.string()),
      currentStock: v.number(),
      minimumStock: v.optional(v.number()),
      unit: v.optional(v.string()),
      isLowStock: v.boolean(),
    })),
  })),
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("equipmentCategories")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const items = await ctx.db
      .query("equipmentItems")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const itemsByCategory = new Map<string, typeof items>();
    for (const item of items) {
      const categoryId = item.categoryId;
      if (!itemsByCategory.has(categoryId)) {
        itemsByCategory.set(categoryId, []);
      }
      itemsByCategory.get(categoryId)!.push(item);
    }

    return categories
      .sort((a, b) => a.order - b.order)
      .map((category) => ({
        category: {
          _id: category._id,
          name: category.name,
          description: category.description,
          order: category.order,
        },
        items: (itemsByCategory.get(category._id) ?? []).map((item) => ({
          _id: item._id,
          name: item.name,
          description: item.description,
          size: item.size,
          currentStock: item.currentStock,
          minimumStock: item.minimumStock,
          unit: item.unit,
          isLowStock: item.minimumStock !== undefined && item.currentStock <= item.minimumStock,
        })),
      }))
      .filter((group) => group.items.length > 0);
  },
});

/**
 * Create a new equipment item
 */
export const createItem = mutation({
  args: {
    name: v.string(),
    categoryId: v.id("equipmentCategories"),
    description: v.optional(v.string()),
    size: v.optional(v.string()),
    initialStock: v.number(),
    minimumStock: v.optional(v.number()),
    unit: v.optional(v.string()),
  },
  returns: v.id("equipmentItems"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to create items");
    }

    // Verify category exists
    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const now = Date.now();
    const itemId = await ctx.db.insert("equipmentItems", {
      name: args.name,
      categoryId: args.categoryId,
      description: args.description,
      size: args.size,
      currentStock: args.initialStock,
      minimumStock: args.minimumStock,
      unit: args.unit,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    });

    // Create initial stock transaction
    if (args.initialStock > 0) {
      await ctx.db.insert("equipmentTransactions", {
        itemId,
        type: "initial",
        quantity: args.initialStock,
        previousStock: 0,
        newStock: args.initialStock,
        notes: "Initial stock entry",
        userId,
        createdAt: now,
      });
    }

    return itemId;
  },
});

/**
 * Update an equipment item
 */
export const updateItem = mutation({
  args: {
    itemId: v.id("equipmentItems"),
    name: v.optional(v.string()),
    categoryId: v.optional(v.id("equipmentCategories")),
    description: v.optional(v.string()),
    size: v.optional(v.string()),
    minimumStock: v.optional(v.number()),
    unit: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update items");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    // If changing category, verify new category exists
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category) {
        throw new Error("Category not found");
      }
    }

    await ctx.db.patch(args.itemId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.categoryId !== undefined && { categoryId: args.categoryId }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.size !== undefined && { size: args.size }),
      ...(args.minimumStock !== undefined && { minimumStock: args.minimumStock }),
      ...(args.unit !== undefined && { unit: args.unit }),
      ...(args.isActive !== undefined && { isActive: args.isActive }),
      updatedAt: Date.now(),
      updatedBy: userId,
    });

    return null;
  },
});

/**
 * Delete an equipment item
 */
export const deleteItem = mutation({
  args: {
    itemId: v.id("equipmentItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to delete items");
    }

    // Delete all transactions for this item
    const transactions = await ctx.db
      .query("equipmentTransactions")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    for (const transaction of transactions) {
      await ctx.db.delete(transaction._id);
    }

    await ctx.db.delete(args.itemId);
    return null;
  },
});

// ============================================================================
// TRANSACTION FUNCTIONS
// ============================================================================

/**
 * Take item from stock (for regular users)
 */
export const takeItem = mutation({
  args: {
    itemId: v.id("equipmentItems"),
    quantity: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to take items");
    }

    if (args.quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    if (!item.isActive) {
      throw new Error("This item is no longer available");
    }

    if (item.currentStock < args.quantity) {
      throw new Error(`Not enough stock. Only ${item.currentStock} available.`);
    }

    const newStock = item.currentStock - args.quantity;
    const now = Date.now();

    // Update item stock
    await ctx.db.patch(args.itemId, {
      currentStock: newStock,
      updatedAt: now,
      updatedBy: userId,
    });

    // Record transaction
    await ctx.db.insert("equipmentTransactions", {
      itemId: args.itemId,
      type: "take",
      quantity: -args.quantity,
      previousStock: item.currentStock,
      newStock,
      notes: args.notes,
      userId,
      createdAt: now,
    });

    return null;
  },
});

/**
 * Replenish item stock (for managers)
 */
export const replenishItem = mutation({
  args: {
    itemId: v.id("equipmentItems"),
    quantity: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to replenish items");
    }

    if (args.quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    const newStock = item.currentStock + args.quantity;
    const now = Date.now();

    // Update item stock
    await ctx.db.patch(args.itemId, {
      currentStock: newStock,
      updatedAt: now,
      updatedBy: userId,
    });

    // Record transaction
    await ctx.db.insert("equipmentTransactions", {
      itemId: args.itemId,
      type: "replenish",
      quantity: args.quantity,
      previousStock: item.currentStock,
      newStock,
      notes: args.notes,
      userId,
      createdAt: now,
    });

    return null;
  },
});

/**
 * Adjust item stock (for managers - can be positive or negative)
 */
export const adjustStock = mutation({
  args: {
    itemId: v.id("equipmentItems"),
    newStockLevel: v.number(),
    notes: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to adjust stock");
    }

    if (args.newStockLevel < 0) {
      throw new Error("Stock level cannot be negative");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    const difference = args.newStockLevel - item.currentStock;
    const now = Date.now();

    // Update item stock
    await ctx.db.patch(args.itemId, {
      currentStock: args.newStockLevel,
      updatedAt: now,
      updatedBy: userId,
    });

    // Record transaction
    await ctx.db.insert("equipmentTransactions", {
      itemId: args.itemId,
      type: "adjustment",
      quantity: difference,
      previousStock: item.currentStock,
      newStock: args.newStockLevel,
      notes: args.notes,
      userId,
      createdAt: now,
    });

    return null;
  },
});

/**
 * Get transaction history for an item
 */
export const getItemTransactions = query({
  args: {
    itemId: v.id("equipmentItems"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("equipmentTransactions"),
    type: v.union(
      v.literal("take"),
      v.literal("replenish"),
      v.literal("adjustment"),
      v.literal("initial")
    ),
    quantity: v.number(),
    previousStock: v.number(),
    newStock: v.number(),
    notes: v.optional(v.string()),
    userName: v.string(),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("equipmentTransactions")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .order("desc");

    const transactions = args.limit
      ? await query.take(args.limit)
      : await query.collect();

    // Get user names
    const userIds = [...new Set(transactions.map((t) => t.userId))];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userMap = new Map(
      users.filter(Boolean).map((u) => [u!._id, u!.firstName ?? u!.name ?? "Unknown"])
    );

    return transactions.map((t) => ({
      _id: t._id,
      type: t.type,
      quantity: t.quantity,
      previousStock: t.previousStock,
      newStock: t.newStock,
      notes: t.notes,
      userName: userMap.get(t.userId) ?? "Unknown",
      createdAt: t.createdAt,
    }));
  },
});

/**
 * Get recent transactions across all items
 */
export const getRecentTransactions = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("equipmentTransactions"),
    itemId: v.id("equipmentItems"),
    itemName: v.string(),
    type: v.union(
      v.literal("take"),
      v.literal("replenish"),
      v.literal("adjustment"),
      v.literal("initial")
    ),
    quantity: v.number(),
    newStock: v.number(),
    notes: v.optional(v.string()),
    userName: v.string(),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const transactions = await ctx.db
      .query("equipmentTransactions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);

    // Get item and user info
    const itemIds = [...new Set(transactions.map((t) => t.itemId))];
    const userIds = [...new Set(transactions.map((t) => t.userId))];

    const items = await Promise.all(itemIds.map((id) => ctx.db.get(id)));
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));

    const itemMap = new Map(
      items.filter(Boolean).map((i) => [i!._id, i!.name])
    );
    const userMap = new Map(
      users.filter(Boolean).map((u) => [u!._id, u!.firstName ?? u!.name ?? "Unknown"])
    );

    return transactions.map((t) => ({
      _id: t._id,
      itemId: t.itemId,
      itemName: itemMap.get(t.itemId) ?? "Unknown",
      type: t.type,
      quantity: t.quantity,
      newStock: t.newStock,
      notes: t.notes,
      userName: userMap.get(t.userId) ?? "Unknown",
      createdAt: t.createdAt,
    }));
  },
});

/**
 * Get low stock items for alerts
 */
export const getLowStockItems = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("equipmentItems"),
    name: v.string(),
    categoryName: v.string(),
    size: v.optional(v.string()),
    currentStock: v.number(),
    minimumStock: v.number(),
    unit: v.optional(v.string()),
  })),
  handler: async (ctx) => {
    const items = await ctx.db
      .query("equipmentItems")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const lowStockItems = items.filter(
      (item) => item.minimumStock !== undefined && item.currentStock <= item.minimumStock
    );

    const categories = await ctx.db.query("equipmentCategories").collect();
    const categoryMap = new Map(categories.map((c) => [c._id, c.name]));

    return lowStockItems.map((item) => ({
      _id: item._id,
      name: item.name,
      categoryName: categoryMap.get(item.categoryId) ?? "Unknown",
      size: item.size,
      currentStock: item.currentStock,
      minimumStock: item.minimumStock!,
      unit: item.unit,
    }));
  },
});
