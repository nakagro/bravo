import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const MAX_PRESETS = 5;

// Get all message presets for the current user
export const getPresets = query({
    args: {},
    returns: v.array(
        v.object({
            _id: v.id("messagePresets"),
            _creationTime: v.number(),
            userId: v.id("users"),
            message: v.string(),
            order: v.number(),
            createdAt: v.number(),
            updatedAt: v.number(),
        })
    ),
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return [];
        }

        const presets = await ctx.db
            .query("messagePresets")
            .withIndex("by_user_order", (q) => q.eq("userId", userId))
            .collect();

        return presets;
    },
});

// Create a new message preset
export const createPreset = mutation({
    args: {
        message: v.string(),
    },
    returns: v.id("messagePresets"),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("You must be signed in to create a message preset");
        }

        // Check current preset count
        const existingPresets = await ctx.db
            .query("messagePresets")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        if (existingPresets.length >= MAX_PRESETS) {
            throw new Error(`You can have a maximum of ${MAX_PRESETS} message presets`);
        }

        // Determine the next order value
        const maxOrder = existingPresets.reduce(
            (max, preset) => Math.max(max, preset.order),
            -1
        );

        const now = Date.now();
        return await ctx.db.insert("messagePresets", {
            userId,
            message: args.message.trim(),
            order: maxOrder + 1,
            createdAt: now,
            updatedAt: now,
        });
    },
});

// Update an existing message preset
export const updatePreset = mutation({
    args: {
        presetId: v.id("messagePresets"),
        message: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("You must be signed in to update a message preset");
        }

        const preset = await ctx.db.get(args.presetId);
        if (!preset) {
            throw new Error("Preset not found");
        }

        if (preset.userId !== userId) {
            throw new Error("You can only update your own presets");
        }

        await ctx.db.patch(args.presetId, {
            message: args.message.trim(),
            updatedAt: Date.now(),
        });

        return null;
    },
});

// Delete a message preset
export const deletePreset = mutation({
    args: {
        presetId: v.id("messagePresets"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("You must be signed in to delete a message preset");
        }

        const preset = await ctx.db.get(args.presetId);
        if (!preset) {
            throw new Error("Preset not found");
        }

        if (preset.userId !== userId) {
            throw new Error("You can only delete your own presets");
        }

        await ctx.db.delete(args.presetId);

        return null;
    },
});
