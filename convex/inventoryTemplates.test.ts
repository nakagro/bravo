// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);

  const { adminId, memberId } = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Equipment officer",
      rank: "Lieutenant" as const,
      isAdmin: true,
    });
    const memberId = await ctx.db.insert("users", {
      name: "Crew member",
      rank: "Firefighter" as const,
    });
    return { adminId, memberId };
  });

  const addTemplate = async (
    name: string,
    status?: "active" | "inactive" | "archived"
  ) =>
    await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("applianceTemplates", {
        name,
        version: 1,
        // Deliberately omitted when undefined, so the row looks exactly like
        // one written before the status field existed.
        ...(status ? { status } : {}),
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminId,
      });
    });

  return {
    t,
    adminId,
    memberId,
    addTemplate,
    asAdmin: t.withIdentity({ subject: adminId }),
    asMember: t.withIdentity({ subject: memberId }),
  };
}

const names = (templates: { name: string }[]) => templates.map((x) => x.name).sort();

describe("template status filtering", () => {
  it("treats a template with no status as active", async () => {
    // The no-migration guarantee: every existing row has no status field, and
    // must keep showing up for members without anything being backfilled.
    const { addTemplate, asMember } = await setup();
    await addTemplate("Pumper - MDA848");

    const result = await asMember.query(api.inventoryTemplates.listTemplates, {});

    expect(names(result)).toEqual(["Pumper - MDA848"]);
  });

  it("defaults to active only, hiding inactive and archived", async () => {
    const { addTemplate, asMember } = await setup();
    await addTemplate("Pumper - MDA848");
    await addTemplate("FCV - 1FM3LJ", "active");
    await addTemplate("Tanker spare", "inactive");
    await addTemplate("Old pumper", "archived");

    const result = await asMember.query(api.inventoryTemplates.listTemplates, {});

    expect(names(result)).toEqual(["FCV - 1FM3LJ", "Pumper - MDA848"]);
  });

  it("returns the other statuses when asked for explicitly", async () => {
    // The admin Templates tab has to opt out of the default, or the very
    // screen that manages deactivated templates can't see them.
    const { addTemplate, asAdmin } = await setup();
    await addTemplate("Pumper - MDA848");
    await addTemplate("Tanker spare", "inactive");
    await addTemplate("Old pumper", "archived");

    const editable = await asAdmin.query(api.inventoryTemplates.listTemplates, {
      statuses: ["active", "inactive"],
    });
    const archived = await asAdmin.query(api.inventoryTemplates.listTemplates, {
      statuses: ["archived"],
    });

    expect(names(editable)).toEqual(["Pumper - MDA848", "Tanker spare"]);
    expect(names(archived)).toEqual(["Old pumper"]);
  });

  it("keeps the deprecated getApplianceTemplates alias unfiltered", async () => {
    // The live frontend still calls this one. If it started filtering, a
    // backend-first deploy would hide templates from the deployed UI.
    const { addTemplate, asMember } = await setup();
    await addTemplate("Pumper - MDA848");
    await addTemplate("Old pumper", "archived");

    const result = await asMember.query(
      api.inventoryTemplates.getApplianceTemplates,
      {}
    );

    expect(names(result)).toEqual(["Old pumper", "Pumper - MDA848"]);
  });
});

describe("setTemplateStatus", () => {
  it("deactivates and reactivates a template", async () => {
    const { addTemplate, asAdmin } = await setup();
    const templateId = await addTemplate("Pumper - MDA848");

    await asAdmin.mutation(api.inventoryTemplates.setTemplateStatus, {
      templateId,
      status: "inactive",
    });
    expect(
      names(await asAdmin.query(api.inventoryTemplates.listTemplates, {}))
    ).toEqual([]);

    await asAdmin.mutation(api.inventoryTemplates.setTemplateStatus, {
      templateId,
      status: "active",
    });
    expect(
      names(await asAdmin.query(api.inventoryTemplates.listTemplates, {}))
    ).toEqual(["Pumper - MDA848"]);
  });

  it("refuses a member without inventory admin", async () => {
    const { addTemplate, asMember } = await setup();
    const templateId = await addTemplate("Pumper - MDA848");

    await expect(
      asMember.mutation(api.inventoryTemplates.setTemplateStatus, {
        templateId,
        status: "archived",
      })
    ).rejects.toThrow(/access to manage inventory templates/);
  });
});

describe("startRun respects template status", () => {
  const startRun = (
    asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
    templateId: Id<"applianceTemplates">
  ) => asUser.mutation(api.inventoryCheckRuns.startRun, { templateId });

  it("allows a run on a template with no status", async () => {
    const { addTemplate, asMember } = await setup();
    const templateId = await addTemplate("Pumper - MDA848");

    await expect(startRun(asMember, templateId)).resolves.toBeDefined();
  });

  it("refuses a run on an out-of-service appliance", async () => {
    const { addTemplate, asMember } = await setup();
    const templateId = await addTemplate("Tanker spare", "inactive");

    await expect(startRun(asMember, templateId)).rejects.toThrow(
      /out of service/
    );
  });

  it("refuses a run on an archived appliance", async () => {
    const { addTemplate, asMember } = await setup();
    const templateId = await addTemplate("Old pumper", "archived");

    await expect(startRun(asMember, templateId)).rejects.toThrow(/archived/);
  });
});
