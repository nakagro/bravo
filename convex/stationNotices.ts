import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getModuleUser, requireModule } from "./lib/access";

export const BA_CYLINDERS_NOTICE_KEY = "ba_cylinders_refill";
export const BA_CYLINDERS_NOTICE_TITLE = "BA Cylinders Need Filling";
export const NOTICE_KEY_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
export const NOTICE_TITLE_MAX = 80;
export const NOTICE_DETAIL_MAX = 160;
export const NOTICE_MAX_COUNT = 9999;

export const stationNoticeSeverityValidator = v.union(
  v.literal("info"),
  v.literal("warning"),
);

function userDisplayName(user: Doc<"users"> | null): string | undefined {
  if (!user) return undefined;
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return full || user.name || undefined;
}

const baCylindersNoticeOut = v.object({
  key: v.string(),
  title: v.string(),
  detail: v.optional(v.string()),
  severity: stationNoticeSeverityValidator,
  count: v.optional(v.number()),
  active: v.boolean(),
  updatedBySource: v.union(v.literal("user"), v.literal("kioskHub")),
  updatedByName: v.optional(v.string()),
  updatedByKioskSite: v.optional(v.string()),
  updatedByKioskDevice: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.optional(v.number()),
});

/** Current BA Cylinders refill status for the BA -> Cylinders tab. */
export const getBaCylindersNotice = query({
  args: {},
  returns: v.union(v.null(), baCylindersNoticeOut),
  handler: async (ctx) => {
    const viewer = await getModuleUser(ctx, "baSkills", "baSkillsAdmin");
    if (!viewer) return null;

    const row = await ctx.db
      .query("stationNotices")
      .withIndex("by_key", (q) => q.eq("key", BA_CYLINDERS_NOTICE_KEY))
      .unique();
    if (!row) return null;

    const now = Date.now();
    const expired = row.expiresAt !== undefined && row.expiresAt <= now;
    const active = row.active && !expired;

    let updatedByName: string | undefined;
    if (row.updatedBySource === "user" && row.updatedBy) {
      updatedByName = userDisplayName(await ctx.db.get("users", row.updatedBy));
    } else if (row.updatedBySource === "kioskHub") {
      updatedByName = row.updatedByKioskDevice
        ? row.updatedByKioskDevice
        : row.updatedByKioskSite
          ? `Station Kiosk (${row.updatedByKioskSite})`
          : "Station Kiosk";
    }

    return {
      key: row.key,
      title: row.title,
      ...(active && row.detail !== undefined ? { detail: row.detail } : {}),
      severity: row.severity,
      ...(active && row.count !== undefined ? { count: row.count } : {}),
      active,
      updatedBySource: row.updatedBySource,
      ...(updatedByName !== undefined ? { updatedByName } : {}),
      ...(row.updatedByKioskSite !== undefined ? { updatedByKioskSite: row.updatedByKioskSite } : {}),
      ...(row.updatedByKioskDevice !== undefined ? { updatedByKioskDevice: row.updatedByKioskDevice } : {}),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(active && row.expiresAt !== undefined ? { expiresAt: row.expiresAt } : {}),
    };
  },
});

/** Flag or update how many empty BA cylinders need attention (syncs live to kiosks and turnout screen). */
export const setBaCylindersNotice = mutation({
  args: {
    count: v.optional(v.number()),
    detail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireModule(
      ctx,
      ["baSkills", "baSkillsAdmin"],
      "You do not have access to update BA cylinder status",
    );

    if (args.count !== undefined) {
      if (!Number.isInteger(args.count) || args.count < 1 || args.count > NOTICE_MAX_COUNT) {
        throw new ConvexError(`Cylinder count must be a whole number from 1 to ${NOTICE_MAX_COUNT}`);
      }
    }

    const trimmedDetail = args.detail?.trim() ?? "";
    if (trimmedDetail.length > NOTICE_DETAIL_MAX) {
      throw new ConvexError(`Note must be at most ${NOTICE_DETAIL_MAX} characters`);
    }
    const detail = trimmedDetail.length > 0 ? trimmedDetail : undefined;

    const now = Date.now();
    const existing = await ctx.db
      .query("stationNotices")
      .withIndex("by_key", (q) => q.eq("key", BA_CYLINDERS_NOTICE_KEY))
      .unique();
    const wasActive =
      existing !== null &&
      existing.active &&
      (existing.expiresAt === undefined || existing.expiresAt > now);

    const fields = {
      title: BA_CYLINDERS_NOTICE_TITLE,
      detail,
      severity: "warning" as const,
      count: args.count,
      active: true,
      updatedBy: user._id,
      updatedBySource: "user" as const,
      updatedByKioskSite: undefined,
      updatedByKioskDevice: undefined,
      updatedAt: now,
      expiresAt: undefined,
    };

    if (existing) {
      await ctx.db.patch("stationNotices", existing._id, {
        ...fields,
        ...(wasActive ? {} : { createdAt: now }),
      });
    } else {
      await ctx.db.insert("stationNotices", {
        key: BA_CYLINDERS_NOTICE_KEY,
        ...fields,
        createdAt: now,
      });
    }
    return null;
  },
});

/** Clear the empty BA cylinders notice once cylinders have been sorted. */
export const clearBaCylindersNotice = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireModule(
      ctx,
      ["baSkills", "baSkillsAdmin"],
      "You do not have access to clear BA cylinder status",
    );

    const now = Date.now();
    const existing = await ctx.db
      .query("stationNotices")
      .withIndex("by_key", (q) => q.eq("key", BA_CYLINDERS_NOTICE_KEY))
      .unique();

    const fields = {
      title: BA_CYLINDERS_NOTICE_TITLE,
      detail: undefined,
      severity: "warning" as const,
      count: undefined,
      active: false,
      updatedBy: user._id,
      updatedBySource: "user" as const,
      updatedByKioskSite: undefined,
      updatedByKioskDevice: undefined,
      updatedAt: now,
      expiresAt: undefined,
    };

    if (existing) {
      await ctx.db.patch("stationNotices", existing._id, fields);
    } else {
      await ctx.db.insert("stationNotices", {
        key: BA_CYLINDERS_NOTICE_KEY,
        ...fields,
        createdAt: now,
      });
    }
    return null;
  },
});
