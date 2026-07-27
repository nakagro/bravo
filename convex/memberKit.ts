import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireModuleAccess } from "./modules";
import { isMemberAccount } from "./lib/accountType";
import {
  KitValue,
  isKitSizeValue,
  kitHistoryReasonValidator,
  kitTracksValidator,
  kitValueValidator,
  kitValuesEqual,
  type KitHistoryReason,
} from "./lib/memberKit";

// ─── Access ─────────────────────────────────────────────────────────────────

/**
 * Two gates, both officer-only. `memberRecords` records kit against members;
 * `memberRecordsAdmin` defines what kit exists. There is deliberately no
 * member-facing surface: a member cannot view their own record.
 */
export async function requireKitAccess(ctx: QueryCtx | MutationCtx) {
  return requireModuleAccess(ctx, "memberRecords", "You do not have access to member records");
}

export async function requireKitAdmin(ctx: QueryCtx | MutationCtx) {
  return requireModuleAccess(
    ctx,
    "memberRecordsAdmin",
    "You do not have access to manage the kit register",
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function userDisplayName(user: Doc<"users"> | null | undefined): string {
  if (!user) return "Unknown";
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return full || user.name || "Unknown";
}

const rankValidator = v.union(
  v.literal("Brigade Member"),
  v.literal("Probationary"),
  v.literal("Firefighter"),
  v.literal("Lieutenant"),
  v.literal("Captain"),
);

export const chartValidator = v.object({
  _id: v.id("memberKitSizeCharts"),
  itemId: v.id("memberKitItems"),
  /** Absent when the item only ever comes in one make. */
  name: v.optional(v.string()),
  order: v.number(),
  sizes: v.array(v.string()),
});

export const itemValidator = v.object({
  _id: v.id("memberKitItems"),
  setId: v.optional(v.id("memberKitSets")),
  name: v.string(),
  description: v.optional(v.string()),
  order: v.number(),
  tracks: kitTracksValidator,
  options: v.optional(v.array(v.string())),
  isArchived: v.boolean(),
  /** Populated for "size" items only. */
  charts: v.array(chartValidator),
});

const entryValidator = v.object({
  itemId: v.id("memberKitItems"),
  itemName: v.string(),
  tracks: kitTracksValidator,
  value: v.optional(kitValueValidator),
  /** Pre-formatted for display, so the profile never resolves charts itself. */
  display: v.optional(v.string()),
  updatedAt: v.optional(v.number()),
  updatedByName: v.optional(v.string()),
});

async function chartsForItem(ctx: QueryCtx | MutationCtx, itemId: Id<"memberKitItems">) {
  return await ctx.db
    .query("memberKitSizeCharts")
    .withIndex("by_item_order", (q) => q.eq("itemId", itemId))
    .order("asc")
    .collect();
}

async function shapeItem(ctx: QueryCtx | MutationCtx, item: Doc<"memberKitItems">) {
  return {
    _id: item._id,
    setId: item.setId,
    name: item.name,
    description: item.description,
    order: item.order,
    tracks: item.tracks,
    options: item.options,
    isArchived: item.isArchived ?? false,
    charts:
      item.tracks === "size"
        ? (await chartsForItem(ctx, item._id)).map((chart) => ({
            _id: chart._id,
            itemId: chart.itemId,
            name: chart.name,
            order: chart.order,
            sizes: chart.sizes,
          }))
        : [],
  };
}

/** Items in one scope: a set, or standalone when `setId` is undefined. */
export async function itemsInScope(
  ctx: QueryCtx | MutationCtx,
  setId: Id<"memberKitSets"> | undefined,
) {
  return await ctx.db
    .query("memberKitItems")
    .withIndex("by_set_order", (q) => q.eq("setId", setId))
    .order("asc")
    .collect();
}

/**
 * Render a value the way a person reads it. History stores the result rather
 * than re-deriving it, so deleting the chart named here never rewrites the past.
 * An unnamed chart contributes nothing: a brace reads "Medium", not " · Medium".
 */
export async function formatKitValue(
  ctx: QueryCtx | MutationCtx,
  item: Doc<"memberKitItems">,
  value: KitValue | null | undefined,
): Promise<string | undefined> {
  if (value === null || value === undefined) return undefined;

  if (isKitSizeValue(value)) {
    const chart = await ctx.db.get(value.chartId);
    return chart?.name ? `${chart.name} · ${value.size}` : value.size;
  }
  if (typeof value === "boolean") return value ? "Issued" : "Not issued";
  return value;
}

// ─── Value normalisation ────────────────────────────────────────────────────

/**
 * Coerce and validate a submitted value against its item definition. Returns
 * `null` when the submission means "clear this", which deletes the row so
 * "not recorded" stays distinct from a recorded `false`.
 */
export async function normaliseKitValue(
  ctx: QueryCtx | MutationCtx,
  item: Doc<"memberKitItems">,
  value: KitValue | null | undefined,
): Promise<KitValue | null> {
  if (value === null || value === undefined) return null;

  switch (item.tracks) {
    case "serial":
    case "note": {
      if (typeof value !== "string") throw new Error(`${item.name} expects text`);
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    case "date": {
      // A plain YYYY-MM-DD calendar string, not epoch ms: an issue or expiry
      // date must not shift because of a timezone.
      if (typeof value !== "string") throw new Error(`${item.name} expects a date`);
      if (value === "") return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${item.name} expects a date in YYYY-MM-DD form`);
      }
      return value;
    }
    case "held": {
      if (typeof value !== "boolean") throw new Error(`${item.name} expects yes or no`);
      return value;
    }
    case "choice": {
      if (typeof value !== "string") throw new Error(`${item.name} expects an option`);
      if (value === "") return null;
      if (!(item.options ?? []).includes(value)) {
        throw new Error(`"${value}" is not an option for ${item.name}`);
      }
      return value;
    }
    case "size": {
      if (!isKitSizeValue(value)) {
        throw new Error(`${item.name} expects a size chart and a size`);
      }
      const chart = await ctx.db.get(value.chartId);
      if (!chart || chart.itemId !== item._id) {
        throw new Error(`That size chart does not belong to ${item.name}`);
      }
      if (value.size === "") return null;
      if (!chart.sizes.includes(value.size)) {
        throw new Error(
          `"${value.size}" is not a size for ${chart.name ?? item.name}`,
        );
      }
      return { chartId: value.chartId, size: value.size };
    }
  }
}

// ─── History ────────────────────────────────────────────────────────────────

/**
 * Everything a history row needs that isn't per-member, resolved once per
 * mutation rather than per entry.
 */
export interface HistoryScope {
  item: Doc<"memberKitItems">;
  setName: string | undefined;
  actorId: Id<"users">;
  actorName: string;
  now: number;
}

export async function historyScope(
  ctx: MutationCtx,
  item: Doc<"memberKitItems">,
  actorId: Id<"users">,
): Promise<HistoryScope> {
  const [actor, set] = await Promise.all([
    ctx.db.get(actorId),
    item.setId ? ctx.db.get(item.setId) : Promise.resolve(null),
  ]);
  return {
    item,
    setName: set?.name,
    actorId,
    actorName: userDisplayName(actor),
    now: Date.now(),
  };
}

/**
 * Write one immutable history row. Snapshots are captured here, before any
 * definition changes or deletes, so a later rename or delete cannot change how
 * an existing row reads.
 */
export async function writeEntryHistory(
  ctx: MutationCtx,
  scope: HistoryScope,
  userId: Id<"users">,
  previous: KitValue | null,
  next: KitValue | null,
  reason: KitHistoryReason,
) {
  const [previousDisplay, nextDisplay] = await Promise.all([
    formatKitValue(ctx, scope.item, previous),
    formatKitValue(ctx, scope.item, next),
  ]);

  await ctx.db.insert("memberKitEntryHistory", {
    userId,
    itemId: scope.item._id,
    previousValue: previous ?? undefined,
    newValue: next ?? undefined,
    previousDisplaySnapshot: previousDisplay,
    newDisplaySnapshot: nextDisplay,
    reason,
    itemNameSnapshot: scope.item.name,
    setNameSnapshot: scope.setName,
    changedByNameSnapshot: scope.actorName,
    changedBy: scope.actorId,
    changedAt: scope.now,
  });
}

/**
 * Apply one member's value for one item, writing history only when the value
 * materially changed. Returns whether anything was written, so callers can
 * report a no-op honestly.
 */
export async function applyEntry(
  ctx: MutationCtx,
  scope: HistoryScope,
  userId: Id<"users">,
  next: KitValue | null,
): Promise<boolean> {
  const existing = await ctx.db
    .query("memberKitEntries")
    .withIndex("by_user_item", (q) => q.eq("userId", userId).eq("itemId", scope.item._id))
    .first();

  const previous = existing ? existing.value : null;
  if (kitValuesEqual(previous, next)) return false;

  if (next === null) {
    if (existing) await ctx.db.delete(existing._id);
    await writeEntryHistory(ctx, scope, userId, previous, null, "cleared");
    return true;
  }

  if (existing) {
    await ctx.db.patch(existing._id, {
      value: next,
      updatedBy: scope.actorId,
      updatedAt: scope.now,
    });
  } else {
    await ctx.db.insert("memberKitEntries", {
      userId,
      itemId: scope.item._id,
      value: next,
      updatedBy: scope.actorId,
      updatedAt: scope.now,
    });
  }

  await writeEntryHistory(ctx, scope, userId, previous, next, "edited");
  return true;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * The whole kit register: sets in display order with their items, plus the
 * standalone items that belong to no set. One query, the way inventory's
 * `getTemplateStructure` works.
 */
export const getKitDefinitions = query({
  args: { includeArchived: v.optional(v.boolean()) },
  returns: v.object({
    sets: v.array(
      v.object({
        _id: v.id("memberKitSets"),
        name: v.string(),
        description: v.optional(v.string()),
        order: v.number(),
        items: v.array(itemValidator),
      }),
    ),
    standalone: v.array(itemValidator),
  }),
  handler: async (ctx, { includeArchived }) => {
    await requireKitAccess(ctx);

    const visible = (item: Doc<"memberKitItems">) => includeArchived || !item.isArchived;

    const sets = await ctx.db.query("memberKitSets").withIndex("by_order").order("asc").collect();

    return {
      sets: await Promise.all(
        sets.map(async (set) => ({
          _id: set._id,
          name: set.name,
          description: set.description,
          order: set.order,
          items: await Promise.all(
            (await itemsInScope(ctx, set._id)).filter(visible).map((i) => shapeItem(ctx, i)),
          ),
        })),
      ),
      standalone: await Promise.all(
        (await itemsInScope(ctx, undefined)).filter(visible).map((i) => shapeItem(ctx, i)),
      ),
    };
  },
});

/**
 * Every member, with the timestamp of the most recent change to their record.
 * `recordUpdatedAt` comes from history rather than surviving entries, so a
 * clear or a cascade delete still reads as recent activity.
 */
export const listMembers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      memberNumber: v.optional(v.string()),
      rank: v.optional(rankValidator),
      recordUpdatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    await requireKitAccess(ctx);

    const users = await ctx.db.query("users").collect();
    const members = users.filter(isMemberAccount);

    // Newest history row per member, one indexed lookup each. 58 members, and
    // history grows without bound so it must never be collected whole.
    const latest = await Promise.all(
      members.map((member) =>
        ctx.db
          .query("memberKitEntryHistory")
          .withIndex("by_user_changedAt", (q) => q.eq("userId", member._id))
          .order("desc")
          .first(),
      ),
    );

    return members
      .map((u, index) => ({
        _id: u._id,
        name: userDisplayName(u),
        firstName: u.firstName,
        lastName: u.lastName,
        memberNumber: u.memberNumber,
        rank: u.rank,
        recordUpdatedAt: latest[index]?.changedAt,
      }))
      .sort((a, b) =>
        (a.lastName || a.name).localeCompare(b.lastName || b.name, undefined, {
          sensitivity: "base",
        }),
      );
  },
});

/**
 * One member's profile: identity, a block per kit set, and a `standalone` block
 * for the set-less items. Everything the profile page renders, in one
 * subscription. Archived items are excluded from both counts and entries.
 */
export const getMemberKitSummary = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      member: v.object({
        _id: v.id("users"),
        name: v.string(),
        memberNumber: v.optional(v.string()),
        rank: v.optional(rankValidator),
      }),
      sets: v.array(
        v.object({
          setId: v.id("memberKitSets"),
          name: v.string(),
          itemCount: v.number(),
          recordedCount: v.number(),
          entries: v.array(entryValidator),
        }),
      ),
      standalone: v.object({
        itemCount: v.number(),
        recordedCount: v.number(),
        entries: v.array(entryValidator),
      }),
      itemCount: v.number(),
      recordedCount: v.number(),
      latestActivity: v.optional(
        v.object({
          changedAt: v.number(),
          changedByName: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { userId }) => {
    await requireKitAccess(ctx);

    const member = await ctx.db.get(userId);
    // A shared account (DO phone, appliance tablet) has no kit record. Reads the
    // same as a deleted member, which the page already renders as "Member not found".
    if (!member || !isMemberAccount(member)) return null;

    const entries = await ctx.db
      .query("memberKitEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const byItem = new Map(entries.map((entry) => [entry.itemId, entry]));

    // Editors repeat across a member's entries, so resolve each name once.
    const editorIds = [...new Set(entries.map((entry) => entry.updatedBy))];
    const editors = await Promise.all(editorIds.map((id) => ctx.db.get(id)));
    const editorNames = new Map(editorIds.map((id, i) => [id, userDisplayName(editors[i])]));

    const buildEntries = async (items: Doc<"memberKitItems">[]) =>
      await Promise.all(
        items.map(async (item) => {
          const entry = byItem.get(item._id);
          return {
            itemId: item._id,
            itemName: item.name,
            tracks: item.tracks,
            value: entry?.value,
            display: await formatKitValue(ctx, item, entry?.value),
            updatedAt: entry?.updatedAt,
            updatedByName: entry ? editorNames.get(entry.updatedBy) : undefined,
          };
        }),
      );

    const countRecorded = (items: Doc<"memberKitItems">[]) =>
      items.filter((item) => byItem.has(item._id)).length;

    const setDocs = await ctx.db
      .query("memberKitSets")
      .withIndex("by_order")
      .order("asc")
      .collect();

    const sets = await Promise.all(
      setDocs.map(async (set) => {
        const items = (await itemsInScope(ctx, set._id)).filter((i) => !i.isArchived);
        return {
          setId: set._id,
          name: set.name,
          itemCount: items.length,
          recordedCount: countRecorded(items),
          entries: await buildEntries(items),
        };
      }),
    );

    const loose = (await itemsInScope(ctx, undefined)).filter((i) => !i.isArchived);
    const standalone = {
      itemCount: loose.length,
      recordedCount: countRecorded(loose),
      entries: await buildEntries(loose),
    };

    const latest = await ctx.db
      .query("memberKitEntryHistory")
      .withIndex("by_user_changedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    return {
      member: {
        _id: member._id,
        name: userDisplayName(member),
        memberNumber: member.memberNumber,
        rank: member.rank,
      },
      sets,
      standalone,
      itemCount: sets.reduce((sum, s) => sum + s.itemCount, 0) + standalone.itemCount,
      recordedCount:
        sets.reduce((sum, s) => sum + s.recordedCount, 0) + standalone.recordedCount,
      latestActivity: latest
        ? { changedAt: latest.changedAt, changedByName: latest.changedByNameSnapshot }
        : undefined,
    };
  },
});

/**
 * The items to edit in one go, with their charts and this member's current
 * values: what the editor needs to render its controls and detect a dirty draft.
 *
 * A kit set is edited as a whole, because its items are ordered together. A
 * standalone item is edited on its own (`itemId`, with `setId: null`) because it
 * is its own thing: a pager is not part of a group and should never be presented
 * as though it were.
 */
export const getKitScopeForEntry = query({
  args: {
    userId: v.id("users"),
    setId: v.union(v.id("memberKitSets"), v.null()),
    /** Narrows the scope to a single item, which must live in `setId`. */
    itemId: v.optional(v.id("memberKitItems")),
  },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      memberName: v.string(),
      items: v.array(itemValidator),
      values: v.array(
        v.object({ itemId: v.id("memberKitItems"), value: kitValueValidator }),
      ),
    }),
  ),
  handler: async (ctx, { userId, setId, itemId }) => {
    await requireKitAccess(ctx);

    const member = await ctx.db.get(userId);
    if (!member) return null;

    let title = "Kit";
    if (setId !== null) {
      const set = await ctx.db.get(setId);
      if (!set) return null;
      title = set.name;
    }

    let items = (await itemsInScope(ctx, setId ?? undefined)).filter((i) => !i.isArchived);

    if (itemId !== undefined) {
      const only = items.find((candidate) => candidate._id === itemId);
      if (!only) return null;
      items = [only];
      title = only.name;
    }
    const itemIds = new Set(items.map((i) => i._id));

    const entries = await ctx.db
      .query("memberKitEntries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      title,
      memberName: userDisplayName(member),
      items: await Promise.all(items.map((i) => shapeItem(ctx, i))),
      values: entries
        .filter((entry) => itemIds.has(entry.itemId))
        .map((entry) => ({ itemId: entry.itemId, value: entry.value })),
    };
  },
});

/**
 * One item across every member, for the bulk-fill screen. Standalone items are
 * included; recording who has station workwear is one of the module's main jobs.
 */
export const getItemEntriesForAllMembers = query({
  args: { itemId: v.id("memberKitItems") },
  returns: v.union(
    v.null(),
    v.object({
      item: itemValidator,
      setName: v.optional(v.string()),
      members: v.array(
        v.object({
          userId: v.id("users"),
          name: v.string(),
          memberNumber: v.optional(v.string()),
          rank: v.optional(rankValidator),
          value: v.optional(kitValueValidator),
        }),
      ),
    }),
  ),
  handler: async (ctx, { itemId }) => {
    await requireKitAccess(ctx);

    const item = await ctx.db.get(itemId);
    if (!item) return null;

    const set = item.setId ? await ctx.db.get(item.setId) : null;

    const entries = await ctx.db
      .query("memberKitEntries")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .collect();
    const byUser = new Map(entries.map((entry) => [entry.userId, entry.value]));

    const users = await ctx.db.query("users").collect();

    return {
      item: await shapeItem(ctx, item),
      setName: set?.name,
      members: users
        .filter(isMemberAccount)
        .map((u) => ({
          userId: u._id,
          name: userDisplayName(u),
          memberNumber: u.memberNumber,
          rank: u.rank,
          value: byUser.get(u._id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    };
  },
});

/**
 * A member's change history, newest first. Rendered entirely from the
 * immutable snapshots, never re-resolved against live kit definitions.
 */
export const getMemberKitHistory = query({
  args: {
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("memberKitEntryHistory"),
        itemName: v.string(),
        setName: v.optional(v.string()),
        previousDisplay: v.optional(v.string()),
        newDisplay: v.optional(v.string()),
        reason: kitHistoryReasonValidator,
        changedByName: v.string(),
        changedAt: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, { userId, paginationOpts }) => {
    await requireKitAccess(ctx);

    const result = await ctx.db
      .query("memberKitEntryHistory")
      .withIndex("by_user_changedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(paginationOpts);

    return {
      ...result,
      page: result.page.map((row) => ({
        _id: row._id,
        itemName: row.itemNameSnapshot,
        setName: row.setNameSnapshot,
        previousDisplay: row.previousDisplaySnapshot,
        newDisplay: row.newDisplaySnapshot,
        reason: row.reason,
        changedByName: row.changedByNameSnapshot,
        changedAt: row.changedAt,
      })),
    };
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * One member, one item. Kept for isolated updates; blur is never its submit
 * event; the set and bulk screens save explicitly.
 */
export const setKitEntry = mutation({
  args: {
    userId: v.id("users"),
    itemId: v.id("memberKitItems"),
    value: v.optional(v.union(kitValueValidator, v.null())),
  },
  returns: v.null(),
  handler: async (ctx, { userId, itemId, value }) => {
    const actorId = await requireKitAccess(ctx);

    const member = await ctx.db.get(userId);
    if (!member || !isMemberAccount(member)) throw new Error("Member not found");

    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Kit item not found");
    if (item.isArchived) throw new Error(`${item.name} is archived and cannot be edited`);

    const normalised = await normaliseKitValue(ctx, item, value);
    await applyEntry(ctx, await historyScope(ctx, item, actorId), userId, normalised);
    return null;
  },
});

/**
 * Save one member's whole set at once, from the set editor's Save button.
 * `setId: null` means the standalone group. Every entry is normalised and
 * checked before the first write, so one bad entry rejects the batch outright.
 */
export const setKitEntries = mutation({
  args: {
    userId: v.id("users"),
    setId: v.union(v.id("memberKitSets"), v.null()),
    entries: v.array(
      v.object({
        itemId: v.id("memberKitItems"),
        value: v.union(kitValueValidator, v.null()),
      }),
    ),
  },
  returns: v.object({ changed: v.number() }),
  handler: async (ctx, { userId, setId, entries }) => {
    const actorId = await requireKitAccess(ctx);

    const member = await ctx.db.get(userId);
    if (!member || !isMemberAccount(member)) throw new Error("Member not found");

    if (setId !== null && !(await ctx.db.get(setId))) throw new Error("Kit set not found");

    const seen = new Set<string>();
    for (const entry of entries) {
      if (seen.has(entry.itemId)) throw new Error("Each kit item may only appear once");
      seen.add(entry.itemId);
    }

    // Validate everything first: a partially applied batch would leave the
    // member's record in a state the officer never asked for.
    const prepared: { item: Doc<"memberKitItems">; value: KitValue | null }[] = [];
    for (const entry of entries) {
      const item = await ctx.db.get(entry.itemId);
      if (!item) throw new Error("Kit item not found");
      if ((item.setId ?? null) !== setId) {
        throw new Error(`${item.name} does not belong to this set`);
      }
      if (item.isArchived) throw new Error(`${item.name} is archived and cannot be edited`);
      prepared.push({ item, value: await normaliseKitValue(ctx, item, entry.value) });
    }

    let changed = 0;
    for (const { item, value } of prepared) {
      const scope = await historyScope(ctx, item, actorId);
      if (await applyEntry(ctx, scope, userId, value)) changed++;
    }
    return { changed };
  },
});

/**
 * Save one item across many members, from the bulk-fill screen's Save button. No
 * `setId` argument: the item already knows its scope, and a standalone item has
 * none to pass.
 */
export const setKitItemEntries = mutation({
  args: {
    itemId: v.id("memberKitItems"),
    entries: v.array(
      v.object({
        userId: v.id("users"),
        value: v.union(kitValueValidator, v.null()),
      }),
    ),
  },
  returns: v.object({ changed: v.number() }),
  handler: async (ctx, { itemId, entries }) => {
    const actorId = await requireKitAccess(ctx);

    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Kit item not found");
    if (item.isArchived) throw new Error(`${item.name} is archived and cannot be edited`);

    const seen = new Set<string>();
    for (const entry of entries) {
      if (seen.has(entry.userId)) throw new Error("Each member may only appear once");
      seen.add(entry.userId);
    }

    const prepared: { userId: Id<"users">; value: KitValue | null }[] = [];
    for (const entry of entries) {
      const member = await ctx.db.get(entry.userId);
      if (!member || !isMemberAccount(member)) throw new Error("Member not found");
      prepared.push({
        userId: entry.userId,
        value: await normaliseKitValue(ctx, item, entry.value),
      });
    }

    const scope = await historyScope(ctx, item, actorId);
    let changed = 0;
    for (const { userId, value } of prepared) {
      if (await applyEntry(ctx, scope, userId, value)) changed++;
    }
    return { changed };
  },
});
