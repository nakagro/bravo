// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Tape colour tester" }),
  );
  return { t, userId, asUser: t.withIdentity({ subject: userId }) };
}

describe("hose tape colours", () => {
  it("converts legacy solid and striped names when listing mappings", async () => {
    const { t, userId, asUser } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("hoseTapeColors", {
        year: 2025,
        color: "Blue",
        updatedBy: userId,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("hoseTapeColors", {
        year: 2026,
        color: "Green/Gold Stripe",
        updatedBy: userId,
        updatedAt: Date.now(),
      });
    });

    const mappings = await asUser.query(api.hoseTapeColors.list, {});

    expect(mappings.map(({ year, color }) => ({ year, color }))).toEqual([
      {
        year: 2026,
        color: { primary: "#16a34a", secondary: "#eab308" },
      },
      { year: 2025, color: { primary: "#2563eb" } },
    ]);
  });

  it("stores user-selected solid and striped colours", async () => {
    const { asUser } = await setup();

    await asUser.mutation(api.hoseTapeColors.upsert, {
      year: 2027,
      color: { primary: "#123456", secondary: "#fedcba" },
    });

    const mappings = await asUser.query(api.hoseTapeColors.list, {});
    expect(mappings[0].color).toEqual({
      primary: "#123456",
      secondary: "#fedcba",
    });
  });

  it("rejects colours outside the six-digit hex format", async () => {
    const { asUser } = await setup();

    await expect(
      asUser.mutation(api.hoseTapeColors.upsert, {
        year: 2027,
        color: { primary: "not-a-colour" },
      }),
    ).rejects.toThrow("Tape colours must be six-digit hex values");
  });
});
