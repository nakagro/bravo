import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Query to get active vehicle types ordered by order
export const getVehicleTypes = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("vehicleFaultVehicleTypes"),
    _creationTime: v.number(),
    name: v.string(),
    isActive: v.boolean(),
    order: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    return await ctx.db
      .query("vehicleFaultVehicleTypes")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

// Query to get all vehicle types (including inactive) for admin
export const getAllVehicleTypes = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("vehicleFaultVehicleTypes"),
    _creationTime: v.number(),
    name: v.string(),
    isActive: v.boolean(),
    order: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    return await ctx.db
      .query("vehicleFaultVehicleTypes")
      .withIndex("by_order")
      .collect();
  },
});

// Mutation to add a new vehicle type (admin only)
export const addVehicleType = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("vehicleFaultVehicleTypes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Admin access required");

    // Get the highest order number
    const allTypes = await ctx.db
      .query("vehicleFaultVehicleTypes")
      .withIndex("by_order")
      .collect();
    const maxOrder = allTypes.length > 0
      ? Math.max(...allTypes.map((t) => t.order))
      : -1;

    const now = Date.now();
    return await ctx.db.insert("vehicleFaultVehicleTypes", {
      name: args.name,
      isActive: true,
      order: maxOrder + 1,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Mutation to update a vehicle type (admin only)
export const updateVehicleType = mutation({
  args: {
    id: v.id("vehicleFaultVehicleTypes"),
    name: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Admin access required");

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Vehicle type not found");

    const updates: Record<string, any> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.order !== undefined) updates.order = args.order;

    await ctx.db.patch(args.id, updates);
  },
});

// Mutation to delete a vehicle type (admin only) — soft delete if used by existing faults
export const deleteVehicleType = mutation({
  args: {
    id: v.id("vehicleFaultVehicleTypes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Admin access required");

    const vehicleType = await ctx.db.get(args.id);
    if (!vehicleType) throw new Error("Vehicle type not found");

    // Check if any faults use this vehicle type
    const faultsUsingType = await ctx.db
      .query("vehicleFaults")
      .filter((q) => q.eq(q.field("vehicle"), vehicleType.name))
      .first();

    if (faultsUsingType) {
      // Soft delete — deactivate instead
      await ctx.db.patch(args.id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    } else {
      // Hard delete — no faults reference this type
      await ctx.db.delete(args.id);
    }
  },
});

// Mutation to reorder vehicle types (admin only)
export const reorderVehicleTypes = mutation({
  args: {
    orderedIds: v.array(v.id("vehicleFaultVehicleTypes")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Admin access required");

    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], {
        order: i,
        updatedAt: now,
      });
    }
  },
});
