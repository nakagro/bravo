// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function setup() {
  const t = convexTest(schema, modules);
  const token = "station-tablet-token";

  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", {
      name: "Admin",
      isAdmin: true,
    });
    const memberId = await ctx.db.insert("users", { name: "Member" });
    const verifierId = await ctx.db.insert("users", { name: "Verifier" });
    const serviceAccountId = await ctx.db.insert("serviceAccounts", {
      name: "Station Tablet",
      pinHash: "unused",
      isActive: true,
      allowedModules: ["kiosk"],
      createdBy: adminId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("serviceAccountSessions", {
      serviceAccountId,
      tokenHash: await sha256(token),
      expiresAt: Date.now() + 60_000,
      createdAt: Date.now(),
    });
    return { adminId, memberId, verifierId };
  });

  return { t, token, ...ids };
}

async function createKioskRecord(
  setupResult: Awaited<ReturnType<typeof setup>>,
  asHuman = false,
) {
  const { t, token, adminId, memberId, verifierId } = setupResult;
  const caller = asHuman ? t.withIdentity({ subject: adminId }) : t;
  return caller.mutation(api.baRecords.createRecord, {
    memberId,
    dateUsed: "2026-08-15",
    durationMinutes: 30,
    usageType: "drill",
    notes: "Kiosk test",
    verifiedBy: verifierId,
    serviceToken: token,
  });
}

describe("BA kiosk attribution", () => {
  it("uses the service account name when no human auth session exists", async () => {
    const result = await setup();
    await createKioskRecord(result);

    const records = await result.t
      .withIdentity({ subject: result.adminId })
      .query(api.baRecords.listRecords, {});

    expect(records[0]?.verifierName).toBe("Verifier");
    expect(records[0]?.submitterName).toBe("Station Tablet");
    expect(records[0]?.submittedOnBehalf).toBe(true);
  });

  it("still uses the service account when a stale human session is present", async () => {
    const result = await setup();
    await createKioskRecord(result, true);

    const records = await result.t
      .withIdentity({ subject: result.adminId })
      .query(api.baRecords.listRecords, {});

    expect(records[0]?.submitterName).toBe("Station Tablet");
  });
});
