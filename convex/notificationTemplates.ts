import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { displayName } from "./lib/crewSeats";
import {
  NOTIFICATION_TEMPLATES,
  TEMPLATE_KEYS,
  effectiveTemplate,
  isTemplateKey,
  validateTemplate,
} from "./lib/notificationTemplates";

// Admin editor for the message text of targeted notifications. Global admins
// only, the same isAdmin gate as the rest of Notification Settings. The text
// in lib/notificationTemplates.ts is only the default.

async function requireAdmin(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in");
  const user = await ctx.db.get(userId);
  if (!user?.isAdmin) throw new Error("Admin access required");
  return userId;
}

async function storedRow(ctx: QueryCtx, templateKey: string) {
  return await ctx.db
    .query("notificationTemplates")
    .withIndex("by_templateKey", (q) => q.eq("templateKey", templateKey))
    .first();
}

export const listNotificationTemplates = query({
  args: {},
  returns: v.array(
    v.object({
      key: v.string(),
      title: v.string(),
      body: v.string(),
      customised: v.boolean(),
      updatedAt: v.optional(v.number()),
      updatedByName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const out = [];
    for (const key of TEMPLATE_KEYS) {
      const row = await storedRow(ctx, key);
      const text = effectiveTemplate(key, row);
      out.push({
        key,
        ...text,
        customised: !!row,
        updatedAt: row?.updatedAt,
        updatedByName: row ? displayName(await ctx.db.get(row.updatedBy)) : undefined,
      });
    }
    return out;
  },
});

export const saveNotificationTemplate = mutation({
  args: { key: v.string(), title: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);
    if (!isTemplateKey(args.key)) throw new Error("Unknown message template");
    const existing = await storedRow(ctx, args.key);
    const def = NOTIFICATION_TEMPLATES[args.key];
    // Empty means "use the default", so both empty (or both default) is a reset.
    const title = args.title.trim() && args.title !== def.title ? args.title : "";
    const body = args.body.trim() && args.body !== def.body ? args.body : "";
    if (!title && !body) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }
    const error = validateTemplate(args.key, { title, body });
    if (error) throw new Error(error);
    const fields = { templateKey: args.key, title, body, updatedBy: userId, updatedAt: Date.now() };
    if (existing) await ctx.db.replace(existing._id, fields);
    else await ctx.db.insert("notificationTemplates", fields);
    return null;
  },
});

export const resetNotificationTemplate = mutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await storedRow(ctx, args.key);
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});
