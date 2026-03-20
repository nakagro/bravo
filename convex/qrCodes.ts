import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getUserQRCodes = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("qrCodes"),
      _creationTime: v.number(),
      name: v.string(),
      url: v.string(),
      svgData: v.string(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const qrCodes = await ctx.db
      .query("qrCodes")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
      .order("desc")
      .collect();

    return qrCodes;
  },
});

export const createQRCode = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    svgData: v.string(),
  },
  returns: v.id("qrCodes"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const qrCodeId = await ctx.db.insert("qrCodes", {
      name: args.name,
      url: args.url,
      svgData: args.svgData,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return qrCodeId;
  },
});

export const updateQRCode = mutation({
  args: {
    id: v.id("qrCodes"),
    name: v.string(),
    url: v.string(),
    svgData: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("QR code not found");
    }

    if (existing.createdBy !== userId) {
      throw new Error("Not authorized to update this QR code");
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      url: args.url,
      svgData: args.svgData,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const deleteQRCode = mutation({
  args: {
    id: v.id("qrCodes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("QR code not found");
    }

    if (existing.createdBy !== userId) {
      throw new Error("Not authorized to delete this QR code");
    }

    await ctx.db.delete(args.id);

    return null;
  },
});
