// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const BOOK = JSON.stringify({ sections: [], top_level_menu: [], search_index: [] });

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Alex Carter",
      firstName: "Alex",
      lastName: "Carter",
      isAdmin: true,
    });
    const memberId = await ctx.db.insert("users", {
      name: "Jo Adams",
      firstName: "Jo",
      lastName: "Adams",
    });
    const disabledId = await ctx.db.insert("users", {
      name: "Sam Zhu",
      firstName: "Sam",
      lastName: "Zhu",
      isDisabled: true,
    });
    const now = Date.now();
    const kioskId = await ctx.db.insert("serviceAccounts", {
      name: "Station Kiosk",
      pinHash: "x",
      isActive: true,
      allowedModules: ["kiosk"],
      createdBy: adminId,
      createdAt: now,
      updatedAt: now,
    });
    const displayId = await ctx.db.insert("serviceAccounts", {
      name: "Display Board",
      pinHash: "y",
      isActive: true,
      allowedModules: ["availability"],
      createdBy: adminId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("serviceAccountSessions", {
      serviceAccountId: kioskId,
      tokenHash: await sha256("kiosk-token"),
      expiresAt: now + 60_000,
      createdAt: now,
    });
    await ctx.db.insert("serviceAccountSessions", {
      serviceAccountId: displayId,
      tokenHash: await sha256("display-token"),
      expiresAt: now + 60_000,
      createdAt: now,
    });
    await ctx.db.insert("serviceAccountSessions", {
      serviceAccountId: kioskId,
      tokenHash: await sha256("expired-token"),
      expiresAt: now - 1,
      createdAt: now,
    });
    return { adminId, memberId, disabledId };
  });
  return { t, ...ids };
}

async function upload(t: Awaited<ReturnType<typeof setup>>["t"], body = BOOK) {
  return await t.run(async (ctx) => ctx.storage.store(new Blob([body], { type: "application/json" })));
}

describe("contact directory", () => {
  it("is missing until an admin uploads one", async () => {
    const { t, memberId } = await setup();
    const result = await t
      .withIdentity({ subject: memberId })
      .query(api.contactDirectory.getDirectoryFile, {});
    expect(result).toEqual({ status: "missing" });
  });

  it("serves the uploaded file to members and kiosk sessions", async () => {
    const { t, adminId, memberId } = await setup();
    const storageId = await upload(t);
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.contactDirectory.setDirectoryFile, { storageId, fileName: "book.json" });

    const asMember = await t
      .withIdentity({ subject: memberId })
      .query(api.contactDirectory.getDirectoryFile, {});
    expect(asMember.status).toBe("ready");

    const asKiosk = await t.query(api.contactDirectory.getDirectoryFile, {
      serviceToken: "kiosk-token",
    });
    expect(asKiosk.status).toBe("ready");
  });

  it("refuses anonymous, disabled, expired and non-kiosk callers", async () => {
    const { t, adminId, disabledId } = await setup();
    const storageId = await upload(t);
    await t
      .withIdentity({ subject: adminId })
      .mutation(api.contactDirectory.setDirectoryFile, { storageId, fileName: "book.json" });

    const unauthorised = { status: "unauthorised" };
    expect(await t.query(api.contactDirectory.getDirectoryFile, {})).toEqual(unauthorised);
    expect(
      await t
        .withIdentity({ subject: disabledId })
        .query(api.contactDirectory.getDirectoryFile, {}),
    ).toEqual(unauthorised);
    expect(
      await t.query(api.contactDirectory.getDirectoryFile, { serviceToken: "expired-token" }),
    ).toEqual(unauthorised);
    expect(
      await t.query(api.contactDirectory.getDirectoryFile, { serviceToken: "display-token" }),
    ).toEqual(unauthorised);
    expect(
      await t.query(api.contactDirectory.getDirectoryFile, { serviceToken: "made-up" }),
    ).toEqual(unauthorised);
  });

  it("only lets admins upload", async () => {
    const { t, memberId } = await setup();
    const storageId = await upload(t);
    await expect(
      t.withIdentity({ subject: memberId }).mutation(api.contactDirectory.generateUploadUrl, {}),
    ).rejects.toThrow("Admin access required");
    await expect(
      t
        .withIdentity({ subject: memberId })
        .mutation(api.contactDirectory.setDirectoryFile, { storageId, fileName: "x.json" }),
    ).rejects.toThrow("Admin access required");
    await expect(
      t.withIdentity({ subject: memberId }).query(api.contactDirectory.getAdminSummary, {}),
    ).rejects.toThrow("Admin access required");
  });

  it("replaces the previous file and deletes it from storage", async () => {
    const { t, adminId } = await setup();
    const admin = t.withIdentity({ subject: adminId });
    const first = await upload(t);
    await admin.mutation(api.contactDirectory.setDirectoryFile, {
      storageId: first,
      fileName: "old.json",
    });
    const second = await upload(t, BOOK + " ");
    await admin.mutation(api.contactDirectory.setDirectoryFile, {
      storageId: second,
      fileName: "new.json",
      title: "D14 Contact Book 2026-2027",
    });

    const summary = await admin.query(api.contactDirectory.getAdminSummary, {});
    expect(summary).toMatchObject({
      fileName: "new.json",
      title: "D14 Contact Book 2026-2027",
      uploadedByName: "Alex Carter",
    });
    const state = await t.run(async (ctx) => ({
      rows: await ctx.db.query("contactDirectoryFiles").take(10),
      oldFile: await ctx.db.system.get("_storage", first),
    }));
    expect(state.rows).toHaveLength(1);
    expect(state.oldFile).toBeNull();
  });
});
