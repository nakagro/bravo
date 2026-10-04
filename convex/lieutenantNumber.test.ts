// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const { adminId, wellsId, smithId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { name: "Admin", isAdmin: true });
    const wellsId = await ctx.db.insert("users", { name: "Wells", rank: "Lieutenant" as const });
    const smithId = await ctx.db.insert("users", { name: "Smith", rank: "Firefighter" as const });
    return { adminId, wellsId, smithId };
  });
  return {
    t,
    wellsId,
    smithId,
    asAdmin: t.withIdentity({ subject: adminId }),
    asWells: t.withIdentity({ subject: wellsId }),
  };
}

const numberOf = async (t: Awaited<ReturnType<typeof setup>>["t"], id: Id<"users">) =>
  (await t.run(async (ctx) => ctx.db.get(id)))?.lieutenantNumber;

describe("lieutenant numbers", () => {
  it("numbers a Lieutenant, and moves a number that's already held", async () => {
    const { t, asAdmin, wellsId, smithId } = await setup();

    await asAdmin.mutation(api.users.updateUserRank, {
      userId: wellsId,
      rank: "Lieutenant",
      lieutenantNumber: 1,
    });
    expect(await numberOf(t, wellsId)).toBe(1);

    // Smith is promoted straight to 1st Lieutenant; Wells keeps the rank, loses the number
    await asAdmin.mutation(api.users.updateUserRank, {
      userId: smithId,
      rank: "Lieutenant",
      lieutenantNumber: 1,
    });
    expect(await numberOf(t, smithId)).toBe(1);
    expect(await numberOf(t, wellsId)).toBeUndefined();
  });

  it("clears the number when the rank changes, and refuses a 6th", async () => {
    const { t, asAdmin, wellsId } = await setup();

    await asAdmin.mutation(api.users.updateUserRank, {
      userId: wellsId,
      rank: "Lieutenant",
      lieutenantNumber: 2,
    });
    // Saving the rank alone leaves the number where it is
    await asAdmin.mutation(api.users.updateUserRank, { userId: wellsId, rank: "Lieutenant" });
    expect(await numberOf(t, wellsId)).toBe(2);

    await asAdmin.mutation(api.users.updateUserRank, { userId: wellsId, rank: "Captain" });
    expect(await numberOf(t, wellsId)).toBeUndefined();

    await expect(
      asAdmin.mutation(api.users.updateUserRank, {
        userId: wellsId,
        rank: "Lieutenant",
        lieutenantNumber: 6,
      }),
    ).rejects.toThrow(/1st to 5th/);
  });

  it("lets only an admin change rank, roles or admin status", async () => {
    const { asWells, wellsId } = await setup();

    await expect(
      asWells.mutation(api.users.updateUserRank, { userId: wellsId, rank: "Captain" }),
    ).rejects.toThrow(/Only administrators/);
    await expect(
      asWells.mutation(api.users.updateUserRoles, { userId: wellsId, roles: ["Secretary"] }),
    ).rejects.toThrow(/Only administrators/);
    await expect(
      asWells.mutation(api.users.updateUserAdminStatus, { userId: wellsId, isAdmin: true }),
    ).rejects.toThrow(/Only administrators/);
  });
});
