// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const DAY = Date.UTC(2026, 8, 25);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const officerId = await ctx.db.insert("users", {
      name: "Alex Carter", firstName: "Max", lastName: "Carter", rank: "Lieutenant" as const,
    });
    const memberId = await ctx.db.insert("users", {
      name: "Jo Adams", firstName: "Jo", lastName: "Adams", rank: "Firefighter" as const,
    });
    const otherId = await ctx.db.insert("users", {
      name: "Sam Zhu", firstName: "Sam", lastName: "Zhu", rank: "Firefighter" as const,
    });
    await ctx.db.insert("moduleSettings", {
      moduleId: "availabilityAdmin",
      moduleName: "Availability Admin Tab",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      minimumRank: "Lieutenant",
      updatedAt: Date.now(),
    });
    return { officerId, memberId, otherId };
  });
  return {
    t,
    ...ids,
    asOfficer: t.withIdentity({ subject: ids.officerId }),
    asMember: t.withIdentity({ subject: ids.memberId }),
  };
}

describe("deployment crews", () => {
  it("an officer crews an appliance and every member can see it", async () => {
    const { asOfficer, asMember, memberId, otherId, officerId } = await setup();
    await asOfficer.mutation(api.deploymentCrews.createCrew, {
      date: DAY + 5 * 3600_000, // stored at midnight
      applianceName: "  Pumper ",
      driver: { userId: memberId },
      crewLeader: { userId: officerId },
      crewMembers: [{ userId: otherId }, { name: " Pat Lee (Werribee) " }],
    });

    const crews = await asMember.query(api.deploymentCrews.listCrews, {
      startDate: DAY,
      endDate: DAY,
    });
    expect(crews).toHaveLength(1);
    expect(crews[0]).toMatchObject({
      date: DAY,
      applianceName: "Pumper",
      driver: { name: "Jo Adams" },
      crewLeader: { name: "Alex Carter" },
      crewMembers: [
        { name: "Sam Zhu", external: false },
        { name: "Pat Lee (Werribee)", external: true },
      ],
    });
  });

  it("members without the admin tab cannot crew", async () => {
    const { asMember } = await setup();
    await expect(
      asMember.mutation(api.deploymentCrews.createCrew, {
        date: DAY, applianceName: "Tanker", crewMembers: [],
      }),
    ).rejects.toThrow("permission");
  });

  it("refuses a member in two seats, or more than three crew", async () => {
    const { asOfficer, memberId, otherId, officerId } = await setup();
    await expect(
      asOfficer.mutation(api.deploymentCrews.createCrew, {
        date: DAY, applianceName: "Tanker", driver: { userId: memberId }, crewMembers: [{ userId: memberId }],
      }),
    ).rejects.toThrow("one seat");
    await expect(
      asOfficer.mutation(api.deploymentCrews.createCrew, {
        date: DAY, applianceName: "Tanker", crewMembers: [{ userId: memberId }, { userId: otherId }, { userId: officerId }, { name: "Extra" }],
      }),
    ).rejects.toThrow("at most 3");
  });

  it("editing can clear a seat, and delete removes the crew", async () => {
    const { asOfficer, memberId } = await setup();
    const crewId = await asOfficer.mutation(api.deploymentCrews.createCrew, {
      date: DAY, applianceName: "FCV", driver: { userId: memberId }, crewMembers: [],
    });
    await asOfficer.mutation(api.deploymentCrews.updateCrew, {
      crewId, date: DAY, applianceName: "FCV", crewMembers: [],
    });
    let crews = await asOfficer.query(api.deploymentCrews.listCrews, { startDate: DAY, endDate: DAY });
    expect(crews[0].driver).toBeNull();

    await asOfficer.mutation(api.deploymentCrews.deleteCrew, { crewId });
    crews = await asOfficer.query(api.deploymentCrews.listCrews, { startDate: DAY, endDate: DAY });
    expect(crews).toHaveLength(0);
  });
});
