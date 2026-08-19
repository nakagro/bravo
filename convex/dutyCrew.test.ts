// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// 3rd Sunday of August 2026, as UTC midnight - the contract getDutyCrewForDate
// expects, since Convex runs in UTC.
const THIRD_SUNDAY = Date.UTC(2026, 7, 16);

async function setupCrews() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Crew member" });
    const crewIds = [];
    for (const number of [1, 2, 3, 4]) {
      crewIds.push(
        await ctx.db.insert("dutyCrew", {
          name: `Duty Crew ${number}`,
          number,
          members: [userId],
          leader: userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      );
    }
    return { userId, crewIds };
  });
  return { t, ...ids };
}

describe("getDutyCrewForDate", () => {
  it("returns the rotation crew for a past Sunday", async () => {
    const { t, userId } = await setupCrews();

    const crew = await t.query(api.dutyCrew.getDutyCrewForDate, {
      date: THIRD_SUNDAY,
    });

    expect(crew?.name).toBe("Duty Crew 3");
    expect(crew?.number).toBe(3);
    expect(crew?.isSpecial).toBe(false);
    expect(crew?.members).toEqual([userId]);
  });

  it("returns a manual override ahead of the rotation", async () => {
    const { t, crewIds, userId } = await setupCrews();

    await t.run((ctx) =>
      ctx.db.insert("dutyCrewSchedule", {
        date: THIRD_SUNDAY,
        dutyCrewId: crewIds[0],
        isSpecial: false,
        notes: "Swapped with Crew 3",
        createdBy: userId,
        updatedAt: Date.now(),
      })
    );

    const crew = await t.query(api.dutyCrew.getDutyCrewForDate, {
      date: THIRD_SUNDAY,
    });

    expect(crew?.name).toBe("Duty Crew 1");
    expect(crew?.notes).toBe("Swapped with Crew 3");
  });

  it("marks the 5th Sunday as all-crews", async () => {
    const { t } = await setupCrews();

    // Sundays in August 2026 fall on the 2nd, 9th, 16th, 23rd and 30th
    const crew = await t.query(api.dutyCrew.getDutyCrewForDate, {
      date: Date.UTC(2026, 7, 30),
    });

    expect(crew?.isSpecial).toBe(true);
    expect(crew?.name).toBe("All Duty Crews");
    expect(crew?.number).toBe(0);
  });

  it("returns null for a day that is not a Sunday", async () => {
    const { t } = await setupCrews();

    const crew = await t.query(api.dutyCrew.getDutyCrewForDate, {
      date: Date.UTC(2026, 7, 19),
    });

    expect(crew).toBeNull();
  });
});
