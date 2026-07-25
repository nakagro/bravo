import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  historyScope,
  itemsInScope,
  requireKitAccess,
  requireKitAdmin,
  writeEntryHistory,
} from "./memberKit";
import { isKitSizeValue, kitTracksValidator, type KitHistoryReason } from "./lib/memberKit";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Only "choice" carries a flat list of options. */
function optionsAllowed(tracks: string) {
  return tracks === "choice";
}

function cleanStrings(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  const cleaned = values.map((value) => value.trim()).filter((value) => value !== "");
  if (new Set(cleaned).size !== cleaned.length) throw new Error("Entries must be unique");
  return cleaned;
}

async function entriesForItem(ctx: MutationCtx, itemId: Id<"memberKitItems">) {
  return await ctx.db
    .query("memberKitEntries")
    .withIndex("by_item", (q) => q.eq("itemId", itemId))
    .collect();
}

/**
 * Remove an item's charts, recorded entries and the item itself, writing one
 * history row per entry first so the record of what was held survives the
 * definition that described it.
 */
async function purgeItem(
  ctx: MutationCtx,
  item: Doc<"memberKitItems">,
  actorId: Id<"users">,
  reason: KitHistoryReason,
) {
  const scope = await historyScope(ctx, item, actorId);

  for (const entry of await entriesForItem(ctx, item._id)) {
    // History first: formatting a size value needs the chart, which is about
    // to be deleted alongside it.
    await writeEntryHistory(ctx, scope, entry.userId, entry.value, null, reason);
    await ctx.db.delete(entry._id);
  }

  const charts = await ctx.db
    .query("memberKitSizeCharts")
    .withIndex("by_item", (q) => q.eq("itemId", item._id))
    .collect();
  for (const chart of charts) {
    await ctx.db.delete(chart._id);
  }

  await ctx.db.delete(item._id);
}

/** Renumber a scope's items 1..n, closing any gap left by a move or delete. */
async function resequenceScope(
  ctx: MutationCtx,
  setId: Id<"memberKitSets"> | undefined,
  actorId: Id<"users">,
) {
  const items = await itemsInScope(ctx, setId);
  const now = Date.now();
  for (let index = 0; index < items.length; index++) {
    if (items[index].order !== index + 1) {
      await ctx.db.patch(items[index]._id, {
        order: index + 1,
        updatedBy: actorId,
        updatedAt: now,
      });
    }
  }
}

async function nextOrderInScope(ctx: MutationCtx, setId: Id<"memberKitSets"> | undefined) {
  const items = await itemsInScope(ctx, setId);
  return items.length === 0 ? 1 : Math.max(...items.map((item) => item.order)) + 1;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * How many members have a value recorded against each item. Drives the "this
 * will delete N recorded entries" warning in the delete dialogs.
 */
export const getItemEntryCounts = query({
  args: {},
  returns: v.array(v.object({ itemId: v.id("memberKitItems"), count: v.number() })),
  handler: async (ctx) => {
    await requireKitAccess(ctx);

    // Bounded by members × items (roughly 58 × 20), so one scan is cheaper
    // than an indexed read per item.
    const entries = await ctx.db.query("memberKitEntries").collect();
    const counts = new Map<Id<"memberKitItems">, number>();
    for (const entry of entries) {
      counts.set(entry.itemId, (counts.get(entry.itemId) ?? 0) + 1);
    }
    return [...counts.entries()].map(([itemId, count]) => ({ itemId, count }));
  },
});

// ─── Mutations - Sets ───────────────────────────────────────────────────────

export const createSet = mutation({
  args: { name: v.string(), description: v.optional(v.string()) },
  returns: v.id("memberKitSets"),
  handler: async (ctx, { name, description }) => {
    const userId = await requireKitAdmin(ctx);

    const trimmed = name.trim();
    if (!trimmed) throw new Error("Kit set name is required");

    const last = await ctx.db.query("memberKitSets").withIndex("by_order").order("desc").first();

    const now = Date.now();
    return await ctx.db.insert("memberKitSets", {
      name: trimmed,
      description: description?.trim() || undefined,
      order: last ? last.order + 1 : 1,
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    });
  },
});

export const updateSet = mutation({
  args: {
    setId: v.id("memberKitSets"),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, { setId, name, description }) => {
    const userId = await requireKitAdmin(ctx);

    const set = await ctx.db.get(setId);
    if (!set) throw new Error("Kit set not found");

    const patch: Record<string, unknown> = { updatedBy: userId, updatedAt: Date.now() };

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Kit set name is required");
      patch.name = trimmed;
    }
    // null clears the description; undefined leaves it untouched
    if (description !== undefined) {
      patch.description = description === null ? undefined : description.trim() || undefined;
    }

    await ctx.db.patch(setId, patch);
    return null;
  },
});

/**
 * Deleting a set cascades to its items and their recorded entries. Move
 * anything worth keeping to Individual items first; that is what `moveItem`
 * is the escape hatch for.
 */
export const deleteSet = mutation({
  args: { setId: v.id("memberKitSets") },
  returns: v.null(),
  handler: async (ctx, { setId }) => {
    const userId = await requireKitAdmin(ctx);

    const set = await ctx.db.get(setId);
    if (!set) throw new Error("Kit set not found");

    for (const item of await itemsInScope(ctx, setId)) {
      await purgeItem(ctx, item, userId, "setDeleted");
    }

    await ctx.db.delete(setId);
    return null;
  },
});

export const reorderSets = mutation({
  args: { setIds: v.array(v.id("memberKitSets")) },
  returns: v.null(),
  handler: async (ctx, { setIds }) => {
    const userId = await requireKitAdmin(ctx);

    const existing = await ctx.db.query("memberKitSets").withIndex("by_order").collect();
    if (existing.length !== setIds.length) throw new Error("Reorder must include every kit set");
    const known = new Set(existing.map((set) => set._id));
    for (const setId of setIds) {
      if (!known.has(setId)) throw new Error("Unknown kit set in reorder");
    }

    const now = Date.now();
    for (let index = 0; index < setIds.length; index++) {
      await ctx.db.patch(setIds[index], { order: index + 1, updatedBy: userId, updatedAt: now });
    }
    return null;
  },
});

// ─── Mutations - Items ──────────────────────────────────────────────────────

export const createItem = mutation({
  args: {
    // Absent means standalone: a pager or station workwear needs no set, and
    // inventing a one-item set for it is the mistake this replaces.
    setId: v.optional(v.id("memberKitSets")),
    name: v.string(),
    tracks: kitTracksValidator,
    description: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
  },
  returns: v.id("memberKitItems"),
  handler: async (ctx, { setId, name, tracks, description, options }) => {
    const userId = await requireKitAdmin(ctx);

    if (setId !== undefined && !(await ctx.db.get(setId))) throw new Error("Kit set not found");

    const trimmed = name.trim();
    if (!trimmed) throw new Error("Item name is required");

    const cleaned = optionsAllowed(tracks) ? cleanStrings(options) : undefined;
    if (optionsAllowed(tracks) && (!cleaned || cleaned.length === 0)) {
      throw new Error("A choice item needs at least one option");
    }

    const now = Date.now();
    return await ctx.db.insert("memberKitItems", {
      setId,
      name: trimmed,
      description: description?.trim() || undefined,
      order: await nextOrderInScope(ctx, setId),
      tracks,
      options: cleaned,
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    });
  },
});

export const updateItem = mutation({
  args: {
    itemId: v.id("memberKitItems"),
    name: v.optional(v.string()),
    tracks: v.optional(kitTracksValidator),
    description: v.optional(v.union(v.string(), v.null())),
    options: v.optional(v.array(v.string())),
    isArchived: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { itemId, name, tracks, description, options, isArchived }) => {
    const userId = await requireKitAdmin(ctx);

    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Kit item not found");

    const recorded = await entriesForItem(ctx, itemId);

    // Changing what an item tracks would reinterpret every stored value, so it
    // is only allowed while nothing is recorded. Archive and add a new item.
    if (tracks !== undefined && tracks !== item.tracks && recorded.length > 0) {
      throw new Error(
        `${item.name} already has ${recorded.length} recorded value(s), so what it tracks cannot be changed. Archive it and add a new item instead.`,
      );
    }

    const nextTracks = tracks ?? item.tracks;
    const patch: Record<string, unknown> = { updatedBy: userId, updatedAt: Date.now() };

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Item name is required");
      patch.name = trimmed;
    }
    if (description !== undefined) {
      patch.description = description === null ? undefined : description.trim() || undefined;
    }
    if (tracks !== undefined) patch.tracks = tracks;
    // Archiving hides the item and rejects new entries; it never deletes
    // recorded values, so no entry history is written for it.
    if (isArchived !== undefined) patch.isArchived = isArchived;

    // Leaving "size" strands the charts (only reachable while unrecorded,
    // since what an item tracks is locked once values exist).
    if (tracks !== undefined && item.tracks === "size" && tracks !== "size") {
      const charts = await ctx.db
        .query("memberKitSizeCharts")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect();
      for (const chart of charts) {
        await ctx.db.delete(chart._id);
      }
    }

    if (optionsAllowed(nextTracks)) {
      if (options !== undefined || tracks !== undefined) {
        const cleaned = cleanStrings(options ?? item.options) ?? [];
        if (cleaned.length === 0) throw new Error("A choice item needs at least one option");

        // Removing an option members are recorded against would orphan their
        // values, so block it rather than silently invalidate.
        const stillAllowed = new Set(cleaned);
        const removed = new Set<string>();
        for (const entry of recorded) {
          if (typeof entry.value === "string" && !stillAllowed.has(entry.value)) {
            removed.add(entry.value);
          }
        }
        if (removed.size > 0) {
          throw new Error(
            `Cannot remove option(s) still recorded against members: ${[...removed].join(", ")}`,
          );
        }
        patch.options = cleaned;
      }
    } else if (tracks !== undefined) {
      patch.options = undefined;
    }

    await ctx.db.patch(itemId, patch);
    return null;
  },
});

/**
 * Move an item between a set and the standalone group, or between sets.
 * Entries are untouched and no entry history is written (the recorded value
 * didn't change), and prior history rows keep the set name they were written
 * with.
 */
export const moveItem = mutation({
  args: {
    itemId: v.id("memberKitItems"),
    setId: v.union(v.id("memberKitSets"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { itemId, setId }) => {
    const userId = await requireKitAdmin(ctx);

    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Kit item not found");

    const destination = setId ?? undefined;
    if ((item.setId ?? undefined) === destination) return null;
    if (destination !== undefined && !(await ctx.db.get(destination))) {
      throw new Error("Kit set not found");
    }

    const source = item.setId;
    await ctx.db.patch(itemId, {
      setId: destination,
      order: await nextOrderInScope(ctx, destination),
      updatedBy: userId,
      updatedAt: Date.now(),
    });

    await resequenceScope(ctx, source, userId);
    return null;
  },
});

export const reorderItems = mutation({
  args: {
    setId: v.union(v.id("memberKitSets"), v.null()),
    itemIds: v.array(v.id("memberKitItems")),
  },
  returns: v.null(),
  handler: async (ctx, { setId, itemIds }) => {
    const userId = await requireKitAdmin(ctx);

    const existing = await itemsInScope(ctx, setId ?? undefined);
    if (existing.length !== itemIds.length) {
      throw new Error("Reorder must include every item in this group");
    }
    const known = new Set(existing.map((item) => item._id));
    for (const itemId of itemIds) {
      if (!known.has(itemId)) throw new Error("Item does not belong to this group");
    }

    const now = Date.now();
    for (let index = 0; index < itemIds.length; index++) {
      await ctx.db.patch(itemIds[index], { order: index + 1, updatedBy: userId, updatedAt: now });
    }
    return null;
  },
});

export const deleteItem = mutation({
  args: { itemId: v.id("memberKitItems") },
  returns: v.null(),
  handler: async (ctx, { itemId }) => {
    const userId = await requireKitAdmin(ctx);

    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Kit item not found");

    const scope = item.setId;
    await purgeItem(ctx, item, userId, "itemDeleted");
    await resequenceScope(ctx, scope, userId);
    return null;
  },
});

// ─── Mutations - Size charts ("size" items only) ────────────────────────────

export const createChart = mutation({
  args: {
    itemId: v.id("memberKitItems"),
    name: v.string(),
    sizes: v.array(v.string()),
  },
  returns: v.id("memberKitSizeCharts"),
  handler: async (ctx, { itemId, name, sizes }) => {
    const userId = await requireKitAdmin(ctx);

    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Kit item not found");
    if (item.tracks !== "size") {
      throw new Error(`${item.name} is not a sized item, so it cannot have size charts`);
    }

    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Size chart name is required");

    const cleanedSizes = cleanStrings(sizes) ?? [];
    if (cleanedSizes.length === 0) throw new Error("A size chart needs at least one size");

    const last = await ctx.db
      .query("memberKitSizeCharts")
      .withIndex("by_item_order", (q) => q.eq("itemId", itemId))
      .order("desc")
      .first();

    const now = Date.now();
    return await ctx.db.insert("memberKitSizeCharts", {
      itemId,
      name: trimmedName,
      order: last ? last.order + 1 : 1,
      sizes: cleanedSizes,
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    });
  },
});

export const updateChart = mutation({
  args: {
    chartId: v.id("memberKitSizeCharts"),
    name: v.optional(v.string()),
    sizes: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, { chartId, name, sizes }) => {
    const userId = await requireKitAdmin(ctx);

    const chart = await ctx.db.get(chartId);
    if (!chart) throw new Error("Size chart not found");

    const patch: Record<string, unknown> = { updatedBy: userId, updatedAt: Date.now() };

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Size chart name is required");
      patch.name = trimmed;
    }

    if (sizes !== undefined) {
      const cleaned = cleanStrings(sizes) ?? [];
      if (cleaned.length === 0) throw new Error("A size chart needs at least one size");

      // Dropping a size someone is already recorded against would orphan them.
      const stillAllowed = new Set(cleaned);
      const removed = new Set<string>();
      for (const entry of await entriesForItem(ctx, chart.itemId)) {
        const recorded = entry.value;
        if (
          isKitSizeValue(recorded) &&
          recorded.chartId === chartId &&
          !stillAllowed.has(recorded.size)
        ) {
          removed.add(recorded.size);
        }
      }
      if (removed.size > 0) {
        throw new Error(
          `Cannot remove size(s) still recorded against members: ${[...removed].join(", ")}`,
        );
      }
      patch.sizes = cleaned;
    }

    await ctx.db.patch(chartId, patch);
    return null;
  },
});

export const deleteChart = mutation({
  args: { chartId: v.id("memberKitSizeCharts") },
  returns: v.null(),
  handler: async (ctx, { chartId }) => {
    const userId = await requireKitAdmin(ctx);

    const chart = await ctx.db.get(chartId);
    if (!chart) throw new Error("Size chart not found");

    const item = await ctx.db.get(chart.itemId);
    if (!item) throw new Error("Kit item not found");

    // Deleting the chart strands every member recorded against it, so clear
    // those entries, recording why, while the chart's name is still resolvable.
    const scope = await historyScope(ctx, item, userId);
    for (const entry of await entriesForItem(ctx, chart.itemId)) {
      const recorded = entry.value;
      if (isKitSizeValue(recorded) && recorded.chartId === chartId) {
        await writeEntryHistory(ctx, scope, entry.userId, recorded, null, "chartDeleted");
        await ctx.db.delete(entry._id);
      }
    }

    await ctx.db.delete(chartId);
    return null;
  },
});

export const reorderCharts = mutation({
  args: {
    itemId: v.id("memberKitItems"),
    chartIds: v.array(v.id("memberKitSizeCharts")),
  },
  returns: v.null(),
  handler: async (ctx, { itemId, chartIds }) => {
    const userId = await requireKitAdmin(ctx);

    const existing = await ctx.db
      .query("memberKitSizeCharts")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .collect();

    if (existing.length !== chartIds.length) {
      throw new Error("Reorder must include every size chart");
    }
    const known = new Set(existing.map((chart) => chart._id));
    for (const chartId of chartIds) {
      if (!known.has(chartId)) throw new Error("Size chart does not belong to this item");
    }

    const now = Date.now();
    for (let index = 0; index < chartIds.length; index++) {
      await ctx.db.patch(chartIds[index], {
        order: index + 1,
        updatedBy: userId,
        updatedAt: now,
      });
    }
    return null;
  },
});
