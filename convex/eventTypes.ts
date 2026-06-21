import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireEventsAdmin } from "./events";

const eventTypeValidator = v.object({
  _id: v.id("eventTypes"),
  _creationTime: v.number(),
  name: v.string(),
  color: v.string(),
  isActive: v.boolean(),
  order: v.number(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/**
 * Active event types ordered for the form dropdown. Any signed-in member can
 * read these (they're just category labels).
 */
export const getEventTypes = query({
  args: {},
  returns: v.array(eventTypeValidator),
  handler: async (ctx) => {
    const types = await ctx.db
      .query("eventTypes")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    return types.sort((a, b) => a.order - b.order);
  },
});

/**
 * All event types (incl. inactive) for the admin manager.
 */
export const getAllEventTypes = query({
  args: {},
  returns: v.array(eventTypeValidator),
  handler: async (ctx) => {
    return await ctx.db.query("eventTypes").withIndex("by_order").collect();
  },
});

export const addEventType = mutation({
  args: {
    name: v.string(),
    color: v.string(),
  },
  returns: v.id("eventTypes"),
  handler: async (ctx, args) => {
    const userId = await requireEventsAdmin(ctx);

    const allTypes = await ctx.db.query("eventTypes").withIndex("by_order").collect();
    const maxOrder = allTypes.length > 0 ? Math.max(...allTypes.map((t) => t.order)) : -1;

    const now = Date.now();
    return await ctx.db.insert("eventTypes", {
      name: args.name,
      color: args.color,
      isActive: true,
      order: maxOrder + 1,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateEventType = mutation({
  args: {
    id: v.id("eventTypes"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventsAdmin(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Event type not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.color !== undefined) updates.color = args.color;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.order !== undefined) updates.order = args.order;

    await ctx.db.patch(args.id, updates);
    return null;
  },
});

/**
 * Delete an event type. Soft-deletes (deactivates) if any event still
 * references it, so existing chips keep resolving; otherwise hard-deletes.
 */
export const deleteEventType = mutation({
  args: { id: v.id("eventTypes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventsAdmin(ctx);

    const type = await ctx.db.get(args.id);
    if (!type) throw new Error("Event type not found");

    const inUse = await ctx.db
      .query("events")
      .withIndex("by_eventTypeId", (q) => q.eq("eventTypeId", args.id))
      .first();

    if (inUse) {
      await ctx.db.patch(args.id, { isActive: false, updatedAt: Date.now() });
    } else {
      await ctx.db.delete(args.id);
    }
    return null;
  },
});

export const reorderEventTypes = mutation({
  args: { orderedIds: v.array(v.id("eventTypes")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireEventsAdmin(ctx);

    const now = Date.now();
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], { order: i, updatedAt: now });
    }
    return null;
  },
});
