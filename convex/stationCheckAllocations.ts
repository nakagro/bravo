import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { weekWindow } from "./stationChecks";

const allocationTargetValidator = v.union(
  v.object({ kind: v.literal("area"), area: v.string() }),
  v.object({ kind: v.literal("check"), checkId: v.id("stationChecks") }),
  v.object({
    kind: v.literal("subitem"),
    subItemId: v.id("stationCheckSubitems"),
  }),
);

const allocationValidator = v.object({
  _id: v.id("stationCheckAllocations"),
  target: allocationTargetValidator,
  assignedTo: v.id("users"),
  assignedBy: v.id("users"),
  updatedAt: v.number(),
});

function targetKey(
  target:
    | { kind: "area"; area: string }
    | { kind: "check"; checkId: string }
    | { kind: "subitem"; subItemId: string },
) {
  if (target.kind === "area") return `area:${target.area.trim()}`;
  if (target.kind === "check") return `check:${target.checkId}`;
  return `subitem:${target.subItemId}`;
}

export const getWeekAllocations = query({
  args: {
    date: v.number(),
    dutyCrewId: v.id("dutyCrew"),
  },
  returns: v.array(allocationValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const { start: weekStart } = weekWindow(args.date);
    const allocations = await ctx.db
      .query("stationCheckAllocations")
      .withIndex("by_weekStart_and_dutyCrewId_and_targetKey", (q) =>
        q.eq("weekStart", weekStart).eq("dutyCrewId", args.dutyCrewId),
      )
      .take(200);

    return allocations.map((allocation) => ({
      _id: allocation._id,
      target:
        allocation.targetKind === "area"
          ? { kind: "area" as const, area: allocation.area! }
          : allocation.targetKind === "check"
            ? { kind: "check" as const, checkId: allocation.checkId! }
            : {
                kind: "subitem" as const,
                subItemId: allocation.subItemId!,
              },
      assignedTo: allocation.assignedTo,
      assignedBy: allocation.assignedBy,
      updatedAt: allocation.updatedAt,
    }));
  },
});

export const setAllocation = mutation({
  args: {
    date: v.number(),
    dutyCrewId: v.id("dutyCrew"),
    target: allocationTargetValidator,
    assignedTo: v.optional(v.id("users")),
  },
  returns: v.union(v.id("stationCheckAllocations"), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const crew = await ctx.db.get(args.dutyCrewId);
    if (!crew) throw new Error("Duty crew not found");
    if (crew.leader !== userId) {
      throw new Error("Only the duty crew leader can allocate checks");
    }
    if (args.assignedTo && !crew.members.includes(args.assignedTo)) {
      throw new Error(
        "Checks can only be allocated to members of this duty crew",
      );
    }

    if (args.target.kind === "area" && !args.target.area.trim()) {
      throw new Error("Area is required");
    }
    if (args.target.kind === "check") {
      const check = await ctx.db.get(args.target.checkId);
      if (!check) throw new Error("Station check not found");
    }
    if (args.target.kind === "subitem") {
      const subItem = await ctx.db.get(args.target.subItemId);
      if (!subItem) throw new Error("Station check subitem not found");
    }

    const { start: weekStart } = weekWindow(args.date);
    const key = targetKey(args.target);
    const existing = await ctx.db
      .query("stationCheckAllocations")
      .withIndex("by_weekStart_and_dutyCrewId_and_targetKey", (q) =>
        q
          .eq("weekStart", weekStart)
          .eq("dutyCrewId", args.dutyCrewId)
          .eq("targetKey", key),
      )
      .unique();

    if (!args.assignedTo) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        assignedTo: args.assignedTo,
        assignedBy: userId,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("stationCheckAllocations", {
      weekStart,
      dutyCrewId: args.dutyCrewId,
      targetKind: args.target.kind,
      targetKey: key,
      area: args.target.kind === "area" ? args.target.area.trim() : undefined,
      checkId: args.target.kind === "check" ? args.target.checkId : undefined,
      subItemId:
        args.target.kind === "subitem" ? args.target.subItemId : undefined,
      assignedTo: args.assignedTo,
      assignedBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});
