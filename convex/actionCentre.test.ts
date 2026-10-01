// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

/**
 * A signed-in account with every relevant module open and nothing filled in, so
 * each members-only provider has something to complain about: no status set
 * (availability), no skills (profile). A notice addressed to the account proves
 * duty-driven providers still run for shared accounts.
 */
async function setup(accountType?: "member" | "shared") {
  const t = convexTest(schema, modules);

  const { userId, noticeId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: "Duty Officer Phone",
      firstName: "Duty Officer",
      lastName: "Phone",
      rank: "Firefighter" as const,
      ...(accountType ? { accountType } : {}),
    });

    const updatedAt = Date.now();
    for (const moduleId of ["availability", "settings", "events"]) {
      await ctx.db.insert("moduleSettings", {
        moduleId,
        moduleName: moduleId,
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        updatedAt,
      });
    }

    const noticeId = await ctx.db.insert("actionNotices", {
      moduleId: "events",
      conditionKey: "test.notice",
      title: "Station checks completed",
      url: "/dutycrew",
      priority: "medium" as const,
      recipientUserIds: [userId],
      createdAt: updatedAt,
    });

    return { userId, noticeId };
  });

  return { t, as: t.withIdentity({ subject: userId }), userId, noticeId };
}

type SignedIn = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;

async function actionIds(as: SignedIn): Promise<string[]> {
  const actions = await as.query(api.actionCentre.getMyActions, {});
  return actions.map((a) => a.id);
}

describe("action centre / shared accounts", () => {
  it("raises the member obligations for an ordinary member", async () => {
    const { as } = await setup();
    const ids = await actionIds(as);

    expect(ids).toContain("availability:setAvailability");
    expect(ids).toContain("settings:updateSkills");
  });

  it("skips members-only providers for a shared account", async () => {
    const { as } = await setup("shared");
    const ids = await actionIds(as);

    expect(ids).not.toContain("availability:setAvailability");
    expect(ids).not.toContain("settings:updateSkills");
    expect(ids.filter((id) => id.startsWith("events:rsvp:"))).toHaveLength(0);
  });

  it("still delivers a notice addressed to a shared account", async () => {
    const { as, noticeId } = await setup("shared");
    const ids = await actionIds(as);

    expect(ids).toContain(`notice:${noticeId}`);
  });

  it("treats an absent accountType exactly as a member (no-backfill guarantee)", async () => {
    const absent = await actionIds((await setup()).as);
    const explicit = await actionIds((await setup("member")).as);

    expect(absent.sort()).toEqual(explicit.sort());
  });
});

describe("availability board / shared accounts", () => {
  it("omits a shared account from the board while keeping members", async () => {
    const t = convexTest(schema, modules);

    const { memberId, sharedId } = await t.run(async (ctx) => {
      const memberId = await ctx.db.insert("users", {
        name: "Jo Adams",
        firstName: "Jo",
        lastName: "Adams",
        rank: "Firefighter" as const,
      });
      const sharedId = await ctx.db.insert("users", {
        name: "Duty Officer Phone",
        firstName: "Duty Officer",
        lastName: "Phone",
        rank: "Firefighter" as const,
        accountType: "shared" as const,
      });
      return { memberId, sharedId };
    });

    const statuses = await t.query(api.availability.getAllUsersStatus, {});
    const ids = statuses.map((s: { _id: string }) => s._id);

    expect(ids).toContain(memberId as string);
    expect(ids).not.toContain(sharedId as string);
  });

  it("reports its own accountType so the page can hide the You tab", async () => {
    const t = convexTest(schema, modules);

    const sharedId: Id<"users"> = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        name: "Duty Officer Phone",
        firstName: "Duty Officer",
        lastName: "Phone",
        rank: "Firefighter" as const,
        accountType: "shared" as const,
      }),
    );

    const status = await t
      .withIdentity({ subject: sharedId })
      .query(api.availability.getCurrentUserStatus, {});

    expect(status?.accountType).toBe("shared");
  });
});
