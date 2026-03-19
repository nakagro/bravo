import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getToken = query({
    args: {},
    returns: v.union(v.string(), v.null()),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return null;
        }

        const tokenRecord = await ctx.db
            .query("shortcutTokens")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .first();

        return tokenRecord ? tokenRecord.token : null;
    }
});

export const generateToken = mutation({
    args: {},
    returns: v.string(),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("You must be signed in to generate a shortcut token");
        }

        // Revoke previous tokens for this user
        const existingTokens = await ctx.db
            .query("shortcutTokens")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        for (const token of existingTokens) {
            await ctx.db.delete(token._id);
        }

        // Generate a new secure token
        const token = crypto.randomUUID();

        await ctx.db.insert("shortcutTokens", {
            userId,
            token,
            createdAt: Date.now(),
        });

        return token;
    }
});

export const revokeToken = mutation({
    args: {},
    returns: v.null(),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("You must be signed in to revoke your shortcut token");
        }

        const existingTokens = await ctx.db
            .query("shortcutTokens")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();

        for (const token of existingTokens) {
            await ctx.db.delete(token._id);
        }

        return null;
    }
});

export const verifyTokenAndGetUser = internalMutation({
    args: { token: v.string() },
    returns: v.union(v.id("users"), v.null()),
    handler: async (ctx, args) => {
        const tokenRecord = await ctx.db
            .query("shortcutTokens")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!tokenRecord) {
            return null;
        }

        // Update lastUsedAt
        await ctx.db.patch(tokenRecord._id, { lastUsedAt: Date.now() });

        return tokenRecord.userId;
    }
});

export const internalUpdateStatus = internalMutation({
    args: {
        userId: v.id("users"),
        status: v.union(
            v.literal("available - station"),
            v.literal("available - at station"),
            v.literal("available - satellite"),
            v.literal("not available"),
            v.literal("delayed response"),
            v.literal("WFH"),
            v.literal("WFH - at station")
        ),
        durationHours: v.optional(v.number()),
        nextStatus: v.optional(v.union(
            v.literal("available - station"),
            v.literal("available - at station"),
            v.literal("available - satellite"),
            v.literal("not available"),
            v.literal("delayed response"),
            v.literal("WFH"),
            v.literal("WFH - at station"),
            v.literal("reset")
        )),
    },
    returns: v.object({
        userName: v.string(),
        statusExpiresAt: v.union(v.number(), v.null()),
    }),
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        // Update the user's status
        const now = Date.now();
        const statusExpiresAt = args.durationHours ? now + (args.durationHours * 60 * 60 * 1000) : undefined;

        await ctx.db.patch(args.userId, {
            currentStatus: args.status,
            statusUpdatedAt: now,
            statusExpiresAt: statusExpiresAt,
            statusDurationHours: args.durationHours,
            nextStatus: args.nextStatus,
            nextStatusAt: args.nextStatus ? statusExpiresAt : undefined,
        });

        // Record status change in history
        await ctx.db.insert("memberStatusHistory", {
            userId: args.userId,
            status: args.status,
            timestamp: now,
        });

        const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || "Unknown";

        return {
            userName,
            statusExpiresAt: statusExpiresAt ?? null,
        };
    }
});
