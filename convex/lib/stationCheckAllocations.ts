import { QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export type AllocationTarget =
  | { kind: "area"; area: string }
  | { kind: "check"; checkId: string }
  | { kind: "subitem"; subItemId: string };

// Mirrors allocationTargetKey in src/features/dutyCrew/types.ts.
export function targetKey(target: AllocationTarget) {
  if (target.kind === "area") return `area:${target.area.trim()}`;
  if (target.kind === "check") return `check:${target.checkId}`;
  return `subitem:${target.subItemId}`;
}

// A week's allocations for one crew, as target key -> member.
export async function loadAllocationMap(
  ctx: QueryCtx,
  weekStart: number,
  dutyCrewId: Id<"dutyCrew">
): Promise<Map<string, Id<"users">>> {
  const rows = await ctx.db
    .query("stationCheckAllocations")
    .withIndex("by_weekStart_and_dutyCrewId_and_targetKey", (q) =>
      q.eq("weekStart", weekStart).eq("dutyCrewId", dutyCrewId)
    )
    .take(200);
  return new Map(rows.map((row) => [row.targetKey, row.assignedTo]));
}

// Who an item is allocated to: its own allocation wins, otherwise its area's.
// A subitem does not inherit its parent check's allocation - the checklist
// doesn't show it that way, so neither does anything else.
export function effectiveAssignee(
  item: {
    checkId?: Id<"stationChecks">;
    subItemId?: Id<"stationCheckSubitems">;
    area?: string;
  },
  allocations: Map<string, Id<"users">>
): Id<"users"> | undefined {
  const direct = item.subItemId
    ? allocations.get(targetKey({ kind: "subitem", subItemId: item.subItemId }))
    : item.checkId
      ? allocations.get(targetKey({ kind: "check", checkId: item.checkId }))
      : undefined;
  if (direct) return direct;
  return item.area?.trim()
    ? allocations.get(targetKey({ kind: "area", area: item.area }))
    : undefined;
}
