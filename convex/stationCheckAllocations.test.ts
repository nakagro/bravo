// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SUNDAY = new Date("2026-08-09T23:59:59.999").getTime();

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const leaderId = await ctx.db.insert("users", { name: "Crew leader" });
    const memberId = await ctx.db.insert("users", { name: "Crew member" });
    const outsiderId = await ctx.db.insert("users", { name: "Other member" });
    const dutyCrewId = await ctx.db.insert("dutyCrew", {
      name: "Duty Crew 1",
      number: 1,
      members: [leaderId, memberId],
      leader: leaderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const checkId = await ctx.db.insert("stationChecks", {
      name: "Weekly pumper inspection",
      area: "Appliances",
      isActive: true,
      order: 10,
      createdBy: leaderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { leaderId, memberId, outsiderId, dutyCrewId, checkId };
  });
  return {
    t,
    ...ids,
    asLeader: t.withIdentity({ subject: ids.leaderId }),
    asMember: t.withIdentity({ subject: ids.memberId }),
  };
}

describe("station check allocations", () => {
  it("lets the crew leader allocate an area and override an individual check", async () => {
    const { asLeader, dutyCrewId, memberId, leaderId, checkId } = await setup();

    await asLeader.mutation(api.stationCheckAllocations.setAllocation, {
      date: SUNDAY,
      dutyCrewId,
      target: { kind: "area", area: "Appliances" },
      assignedTo: memberId,
    });
    await asLeader.mutation(api.stationCheckAllocations.setAllocation, {
      date: SUNDAY,
      dutyCrewId,
      target: { kind: "check", checkId },
      assignedTo: leaderId,
    });

    const allocations = await asLeader.query(
      api.stationCheckAllocations.getWeekAllocations,
      { date: SUNDAY, dutyCrewId },
    );
    expect(allocations).toHaveLength(2);
    expect(allocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: { kind: "area", area: "Appliances" },
          assignedTo: memberId,
        }),
        expect.objectContaining({
          target: { kind: "check", checkId },
          assignedTo: leaderId,
        }),
      ]),
    );
  });

  it("rejects allocation by a non-leader or to someone outside the crew", async () => {
    const { asLeader, asMember, dutyCrewId, memberId, outsiderId, checkId } =
      await setup();

    await expect(
      asMember.mutation(api.stationCheckAllocations.setAllocation, {
        date: SUNDAY,
        dutyCrewId,
        target: { kind: "check", checkId },
        assignedTo: memberId,
      }),
    ).rejects.toThrow("Only the duty crew leader");

    await expect(
      asLeader.mutation(api.stationCheckAllocations.setAllocation, {
        date: SUNDAY,
        dutyCrewId,
        target: { kind: "check", checkId },
        assignedTo: outsiderId,
      }),
    ).rejects.toThrow("members of this duty crew");
  });
});
