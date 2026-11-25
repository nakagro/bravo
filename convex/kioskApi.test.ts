// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { brigadeDateStr } from "./lib/dates";

const modules = import.meta.glob("./**/*.ts");
const MAIN_TOKEN = "kiosk-main-token-0123456789abcdef0123456789";
const NEXT_TOKEN = "kiosk-main-next-fedcba9876543210fedcba987654";
const SAT_TOKEN = "kiosk-sat-token-aaaabbbbccccddddeeeeffff0000";

type T = ReturnType<typeof convexTest>;

function kioskFetch(
  t: T,
  path: string,
  opts: {
    method?: "GET" | "POST";
    body?: unknown;
    site?: string;
    token?: string | null;
    headers?: Record<string, string>;
  } = {},
) {
  const headers: Record<string, string> = { ...opts.headers };
  const site = opts.site ?? "main";
  if (site !== "") headers["X-Kiosk-Site"] = site;
  const token = opts.token === undefined ? MAIN_TOKEN : opts.token;
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  return t.fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    ...(opts.body !== undefined
      ? { body: typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body) }
      : {}),
  });
}

async function seed(t: T) {
  return t.run(async (ctx) => {
    const now = Date.now();
    const skill = (code: string) =>
      ctx.db.insert("skills", { name: code, code, isActive: true, createdAt: now, updatedAt: now });
    const baiId = await skill("BAi");
    const drId = await skill("DR");
    const adminId = await ctx.db.insert("users", {
      firstName: "Alex",
      lastName: "Carter",
      isAdmin: true,
      rank: "Captain",
    });
    // Wearer: BA-qualified by skill. Admin too, so listMyRecords lets them in.
    const memberId = await ctx.db.insert("users", {
      firstName: "Jordan",
      lastName: "Blake",
      rank: "Firefighter",
      skills: [baiId, drId],
      isAdmin: true,
    });
    const verifierId = await ctx.db.insert("users", {
      firstName: "Sam",
      lastName: "Reyes",
      rank: "Lieutenant",
    });
    const ineligibleId = await ctx.db.insert("users", {
      firstName: "Casey",
      lastName: "Nguyen",
      rank: "Firefighter",
      skills: [drId],
    });
    const disabledId = await ctx.db.insert("users", {
      firstName: "Riley",
      lastName: "Moss",
      rank: "Captain",
      isDisabled: true,
    });
    const sharedId = await ctx.db.insert("users", {
      name: "Duty Officer Phone",
      rank: "Captain",
      accountType: "shared",
    });
    return { adminId, memberId, verifierId, ineligibleId, disabledId, sharedId };
  });
}

let t: T;
let ids: Awaited<ReturnType<typeof seed>>;

beforeEach(async () => {
  vi.stubEnv("KIOSK_HUB_MAIN_TOKEN", MAIN_TOKEN);
  vi.stubEnv("KIOSK_HUB_SATELLITE_TOKEN", SAT_TOKEN);
  t = convexTest(schema, modules);
  ids = await seed(t);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function baBody(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: "sub_1:member",
    memberId: ids.memberId,
    verifiedBy: ids.verifierId,
    dateUsed: brigadeDateStr(0),
    durationMinutes: 30,
    usageType: "firecall",
    notes: "  Structure fire, test street  ",
    kioskDevice: "KIOSK01",
    ...overrides,
  };
}

describe("kiosk hub auth", () => {
  it("rejects a missing or wrong token, a bad site id and an unconfigured site", async () => {
    expect((await kioskFetch(t, "/api/kiosk/v1/sync", { token: null })).status).toBe(401);
    expect((await kioskFetch(t, "/api/kiosk/v1/sync", { token: "nope" })).status).toBe(401);
    expect((await kioskFetch(t, "/api/kiosk/v1/sync", { site: "" })).status).toBe(401);
    expect((await kioskFetch(t, "/api/kiosk/v1/sync", { site: "Main!" })).status).toBe(401);
    // Another site's token does not open this site.
    expect((await kioskFetch(t, "/api/kiosk/v1/sync", { token: SAT_TOKEN })).status).toBe(401);
    // A site with no token configured rejects everything.
    expect(
      (await kioskFetch(t, "/api/kiosk/v1/sync", { site: "workshop", token: "" })).status,
    ).toBe(401);
    expect(
      (await kioskFetch(t, "/api/kiosk/v1/ba-record", { body: baBody(), token: "nope" })).status,
    ).toBe(401);
  });

  it("accepts the site's token and has no CORS headers", async () => {
    const res = await kioskFetch(t, "/api/kiosk/v1/sync");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const sat = await kioskFetch(t, "/api/kiosk/v1/sync", { site: "satellite", token: SAT_TOKEN });
    expect(sat.status).toBe(200);
    expect((await sat.json()).siteId).toBe("satellite");
  });

  it("accepts _TOKEN_NEXT alongside _TOKEN for rotation, and only _NEXT once _TOKEN is cut over", async () => {
    vi.stubEnv("KIOSK_HUB_MAIN_TOKEN_NEXT", NEXT_TOKEN);
    expect((await kioskFetch(t, "/api/kiosk/v1/sync", { token: MAIN_TOKEN })).status).toBe(200);
    expect((await kioskFetch(t, "/api/kiosk/v1/sync", { token: NEXT_TOKEN })).status).toBe(200);

    vi.stubEnv("KIOSK_HUB_MAIN_TOKEN", NEXT_TOKEN);
    vi.stubEnv("KIOSK_HUB_MAIN_TOKEN_NEXT", "");
    expect((await kioskFetch(t, "/api/kiosk/v1/sync", { token: MAIN_TOKEN })).status).toBe(401);
    expect((await kioskFetch(t, "/api/kiosk/v1/sync", { token: NEXT_TOKEN })).status).toBe(200);
  });

  it("KIOSK_HUB_WRITES_DISABLED blocks POSTs with 503 and leaves reads working", async () => {
    vi.stubEnv("KIOSK_HUB_WRITES_DISABLED", "true");
    const loc = await kioskFetch(t, "/api/kiosk/v1/appliance-location", {
      body: { applianceName: "Pumper", stationLocation: "Workshop" },
    });
    expect(loc.status).toBe(503);
    expect((await kioskFetch(t, "/api/kiosk/v1/ba-record", { body: baBody() })).status).toBe(503);
    expect((await kioskFetch(t, "/api/kiosk/v1/sync")).status).toBe(200);
    expect((await kioskFetch(t, "/api/kiosk/v1/contact-directory")).status).toBe(404);
    const rows = await t.run((ctx) => ctx.db.query("baRecords").collect());
    expect(rows).toHaveLength(0);

    // Unauthenticated callers learn nothing about the switch.
    expect(
      (await kioskFetch(t, "/api/kiosk/v1/ba-record", { body: baBody(), token: "nope" })).status,
    ).toBe(401);

    vi.stubEnv("KIOSK_HUB_WRITES_DISABLED", "false");
    expect((await kioskFetch(t, "/api/kiosk/v1/ba-record", { body: baBody() })).status).toBe(200);
  });
});

describe("GET /api/kiosk/v1/sync", () => {
  async function uploadBook() {
    return t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob(['{"contacts":[{"name":"Alex Carter"}]}'], { type: "application/json" }),
      );
      await ctx.db.insert("contactDirectoryFiles", {
        storageId,
        fileName: "d14-contacts.json",
        title: "D14 Contact Book",
        sizeBytes: 38,
        uploadedBy: ids.adminId,
        uploadedAt: 1_763_900_000_000,
      });
    });
  }

  it("returns BA-eligible members only, no contact details, and contact book metadata without a URL", async () => {
    await uploadBook();
    const res = await kioskFetch(t, "/api/kiosk/v1/sync", { headers: { "X-Kiosk-Hub-Build": "2026.11.25-abc" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiVersion).toBe(1);
    expect(body.siteId).toBe("main");
    expect(body.knownLocations).toEqual(["Main Station", "Satellite Station"]);
    const names = body.baMembers.map((m: { name: string }) => m.name);
    // Admin (Captain), member (BAi), verifier (Lieutenant). Not the DR-only
    // firefighter, the disabled captain or the shared phone.
    expect(names).toEqual(["Alex Carter", "Jordan Blake", "Sam Reyes"]);
    const jordan = body.baMembers.find((m: { name: string }) => m.name === "Jordan Blake");
    expect(jordan).toEqual({
      id: ids.memberId,
      name: "Jordan Blake",
      firstName: "Jordan",
      lastName: "Blake",
      rank: "Firefighter",
      skills: ["BAi", "DR"],
    });
    expect(body.contactDirectory).toEqual({
      status: "ready",
      uploadedAt: 1_763_900_000_000,
      sizeBytes: 38,
      fileName: "d14-contacts.json",
      title: "D14 Contact Book",
      etag: '"1763900000000-38"',
    });
    expect(JSON.stringify(body)).not.toMatch(/url|email|phone/i);

    const status = await t.run((ctx) => ctx.db.query("kioskHubStatus").collect());
    expect(status).toHaveLength(1);
    expect(status[0]).toMatchObject({ siteId: "main", buildId: "2026.11.25-abc" });
  });

  it("reports a missing contact book", async () => {
    const body = await (await kioskFetch(t, "/api/kiosk/v1/sync")).json();
    expect(body.contactDirectory).toEqual({ status: "missing" });
  });

  it("scope=appliances returns only appliances and does not touch hub status", async () => {
    const res = await kioskFetch(t, "/api/kiosk/v1/sync?scope=appliances");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(
      ["apiVersion", "applianceLocations", "knownLocations", "siteId", "syncedAt"].sort(),
    );
    const status = await t.run((ctx) => ctx.db.query("kioskHubStatus").collect());
    expect(status).toHaveLength(0);
    expect((await kioskFetch(t, "/api/kiosk/v1/sync?scope=everything")).status).toBe(400);
  });

  it("answers 304 to a matching If-None-Match and a new ETag after a change", async () => {
    for (const path of ["/api/kiosk/v1/sync", "/api/kiosk/v1/sync?scope=appliances"]) {
      const first = await kioskFetch(t, path);
      const etag = first.headers.get("ETag")!;
      expect(etag).toMatch(/^"[af]-[0-9a-f]{32}"$/);

      const again = await kioskFetch(t, path, { headers: { "If-None-Match": etag } });
      expect(again.status).toBe(304);
      expect(again.headers.get("ETag")).toBe(etag);
      expect(await again.text()).toBe("");
    }

    const before = (await kioskFetch(t, "/api/kiosk/v1/sync?scope=appliances")).headers.get("ETag")!;
    await kioskFetch(t, "/api/kiosk/v1/appliance-location", {
      body: { applianceName: "Tanker", stationLocation: "Workshop" },
    });
    const after = await kioskFetch(t, "/api/kiosk/v1/sync?scope=appliances", {
      headers: { "If-None-Match": before },
    });
    expect(after.status).toBe(200);
    expect(after.headers.get("ETag")).not.toBe(before);
    const body = await after.json();
    expect(body.applianceLocations).toEqual([
      expect.objectContaining({ applianceName: "Tanker", stationLocation: "Workshop" }),
    ]);
    expect(body.knownLocations).toEqual(["Main Station", "Satellite Station", "Workshop"]);
  });

  it("a 304 full sync still counts as a heartbeat and keeps the last build", async () => {
    const first = await kioskFetch(t, "/api/kiosk/v1/sync", { headers: { "X-Kiosk-Hub-Build": "b1" } });
    const before = await t.run((ctx) => ctx.db.query("kioskHubStatus").first());
    await new Promise((r) => setTimeout(r, 5));
    const again = await kioskFetch(t, "/api/kiosk/v1/sync", {
      headers: { "If-None-Match": first.headers.get("ETag")! },
    });
    expect(again.status).toBe(304);
    const after = await t.run((ctx) => ctx.db.query("kioskHubStatus").collect());
    expect(after).toHaveLength(1);
    expect(after[0].lastSyncAt).toBeGreaterThan(before!.lastSyncAt);
    expect(after[0].buildId).toBe("b1");
  });
});

describe("GET /api/kiosk/v1/contact-directory", () => {
  it("404s with no book, then streams the blob with an ETag and answers 304", async () => {
    expect((await kioskFetch(t, "/api/kiosk/v1/contact-directory")).status).toBe(404);

    const json = '{"contacts":[{"name":"Alex Carter","phone":"0400 000 000"}]}';
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob([json], { type: "application/json" }));
      await ctx.db.insert("contactDirectoryFiles", {
        storageId,
        fileName: "book.json",
        sizeBytes: json.length,
        uploadedBy: ids.adminId,
        uploadedAt: 1_700_000_000_000,
      });
    });

    expect((await kioskFetch(t, "/api/kiosk/v1/contact-directory", { token: "nope" })).status).toBe(401);

    const res = await kioskFetch(t, "/api/kiosk/v1/contact-directory");
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe(`"1700000000000-${json.length}"`);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.text()).toBe(json);

    const cached = await kioskFetch(t, "/api/kiosk/v1/contact-directory", {
      headers: { "If-None-Match": `W/"1700000000000-${json.length}"` },
    });
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe("");

    const stale = await kioskFetch(t, "/api/kiosk/v1/contact-directory", {
      headers: { "If-None-Match": '"1-1"' },
    });
    expect(stale.status).toBe(200);
  });
});

describe("POST /api/kiosk/v1/appliance-location", () => {
  function move(body: Record<string, unknown>) {
    return kioskFetch(t, "/api/kiosk/v1/appliance-location", { body });
  }

  it("writes a kioskHub row that both existing queries read back", async () => {
    const res = await move({ applianceName: "Pumper", stationLocation: "  Satellite Station ", kioskDevice: "KIOSK01" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      applied: true,
      applianceLocation: { applianceName: "Pumper", stationLocation: "Satellite Station" },
    });

    const admin = t.withIdentity({ subject: ids.adminId });
    const plain = await admin.query(api.applianceLocations.getApplianceLocations, {});
    expect(plain).toEqual([
      expect.objectContaining({
        applianceName: "Pumper",
        updatedBySource: "kioskHub",
        updatedByKioskSite: "main",
        updatedByKioskDevice: "KIOSK01",
      }),
    ]);
    const withUsers = await admin.query(api.applianceLocations.getApplianceLocationsWithUsers, {});
    expect(withUsers[0]).toMatchObject({
      updatedBySource: "kioskHub",
      updatedByKioskSite: "main",
      updatedByKioskDevice: "KIOSK01",
    });
    expect(withUsers[0].updatedByUser).toBeUndefined();
  });

  it("replaces a member's attribution, and a member's later move clears the hub's", async () => {
    const admin = t.withIdentity({ subject: ids.adminId });
    await admin.mutation(api.applianceLocations.updateApplianceLocation, {
      applianceName: "FCV",
      stationLocation: "Main Station",
    });
    await move({ applianceName: "FCV", stationLocation: "Workshop" });
    let [row] = await admin.query(api.applianceLocations.getApplianceLocationsWithUsers, {});
    expect(row.updatedBy).toBeUndefined();
    expect(row.updatedByKioskDevice).toBeUndefined();
    expect(row.updatedByKioskSite).toBe("main");

    await admin.mutation(api.applianceLocations.updateApplianceLocation, {
      applianceName: "FCV",
      stationLocation: "Main Station",
    });
    [row] = await admin.query(api.applianceLocations.getApplianceLocationsWithUsers, {});
    expect(row).toMatchObject({ updatedBySource: "user", updatedBy: ids.adminId });
    expect(row.updatedByKioskSite).toBeUndefined();
  });

  it("drops a stale queued move behind a newer phone update, correcting for the hub's clock", async () => {
    const phoneUpdatedAt = Date.now() - 60_000;
    await t.run((ctx) =>
      ctx.db.insert("applianceLocations", {
        applianceName: "Pumper",
        stationLocation: "Main Station",
        updatedBy: ids.adminId,
        updatedBySource: "user",
        updatedAt: phoneUpdatedAt,
      }),
    );

    // Hub clock runs an hour fast; the tablet saw the move 5 minutes before
    // the hub sent it. Taken raw, occurredAt is in the future and would win.
    const hubNow = Date.now() + 60 * 60_000;
    const stale = await move({
      applianceName: "Pumper",
      stationLocation: "Satellite Station",
      occurredAt: hubNow - 5 * 60_000,
      sentAt: hubNow,
    });
    expect(stale.status).toBe(200);
    expect(await stale.json()).toEqual({
      ok: true,
      applied: false,
      applianceLocation: { applianceName: "Pumper", stationLocation: "Main Station", updatedAt: phoneUpdatedAt },
    });

    // Same skew, but the tablet saw the move after the phone did.
    const fresh = await move({
      applianceName: "Pumper",
      stationLocation: "Satellite Station",
      occurredAt: hubNow - 10_000,
      sentAt: hubNow,
    });
    const body = await fresh.json();
    expect(body.applied).toBe(true);
    expect(body.applianceLocation.updatedAt).toBeGreaterThan(phoneUpdatedAt);
    // updatedAt is BRAVO's clock, not the hub's.
    expect(body.applianceLocation.updatedAt).toBeLessThanOrEqual(Date.now());
  });

  it("validates the body", async () => {
    const bad = [
      "not json",
      [],
      { applianceName: "Ladder", stationLocation: "Main Station" },
      { applianceName: "Pumper", stationLocation: "   " },
      { applianceName: "Pumper", stationLocation: "x".repeat(81) },
      { applianceName: "Pumper", stationLocation: "Main Station", kioskDevice: "x".repeat(41) },
      { applianceName: "Pumper", stationLocation: "Main Station", kioskDevice: 7 },
      { applianceName: "Pumper", stationLocation: "Main Station", occurredAt: 1 },
      { applianceName: "Pumper", stationLocation: "Main Station", occurredAt: 2_000, sentAt: 1_000 },
      { applianceName: "Pumper", stationLocation: "Main Station", occurredAt: "now", sentAt: 1_000 },
      {
        applianceName: "Pumper",
        stationLocation: "Main Station",
        occurredAt: 1_000,
        sentAt: 1_000 + 8 * 24 * 60 * 60_000,
      },
    ];
    for (const body of bad) {
      expect((await move(body as Record<string, unknown>)).status, JSON.stringify(body)).toBe(400);
    }
    const rows = await t.run((ctx) => ctx.db.query("applianceLocations").collect());
    expect(rows).toHaveLength(0);
  });
});

describe("POST /api/kiosk/v1/ba-record", () => {
  function submit(body: Record<string, unknown>) {
    return kioskFetch(t, "/api/kiosk/v1/ba-record", { body });
  }

  it("creates a record owned by the verifier that listRecords and listMyRecords read back", async () => {
    const res = await submit(baBody());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, deduped: false });

    const row = await t.run((ctx) => ctx.db.get(body.recordId as Id<"baRecords">));
    expect(row).toMatchObject({
      memberId: ids.memberId,
      verifiedBy: ids.verifierId,
      submittedBy: ids.verifierId,
      submittedOnBehalf: true,
      submittedByKioskSite: "main",
      submittedByKioskDevice: "KIOSK01",
      clientRequestId: "sub_1:member",
      notes: "Structure fire, test street",
    });
    expect(row!.submittedByServiceAccount).toBeUndefined();

    const all = await t.withIdentity({ subject: ids.adminId }).query(api.baRecords.listRecords, {});
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      memberName: "Jordan Blake",
      verifierName: "Sam Reyes",
      submitterName: "Station Kiosk (KIOSK01)",
      submittedByKioskSite: "main",
      clientRequestId: "sub_1:member",
    });

    const mine = await t.withIdentity({ subject: ids.memberId }).query(api.baRecords.listMyRecords, {});
    expect(mine).toHaveLength(1);
    expect(mine[0].submitterName).toBe("Station Kiosk (KIOSK01)");
  });

  it("names the site when the hub sends no device", async () => {
    await submit(baBody({ kioskDevice: undefined }));
    const [record] = await t.withIdentity({ subject: ids.adminId }).query(api.baRecords.listRecords, {});
    expect(record.submitterName).toBe("Station Kiosk (main)");
  });

  it("dedupes a retry with the same key and refuses a different record under it with 409", async () => {
    const first = await (await submit(baBody())).json();
    const retry = await submit(baBody({ notes: "edited on retry" }));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ ok: true, deduped: true, recordId: first.recordId });

    const otherMember = await submit(baBody({ memberId: ids.adminId }));
    expect(otherMember.status).toBe(409);
    expect((await otherMember.json()).error).toMatch(/clientRequestId/);
    const otherVerifier = await submit(baBody({ verifiedBy: ids.adminId }));
    expect(otherVerifier.status).toBe(409);
    const otherDate = await submit(baBody({ dateUsed: brigadeDateStr(-1) }));
    expect(otherDate.status).toBe(409);

    const rows = await t.run((ctx) => ctx.db.query("baRecords").collect());
    expect(rows).toHaveLength(1);
  });

  it("only accepts active, BA-eligible, distinct members", async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["same person", { verifiedBy: ids.memberId }],
      ["DR-only firefighter as member", { memberId: ids.ineligibleId }],
      ["DR-only firefighter as verifier", { verifiedBy: ids.ineligibleId }],
      ["disabled captain", { verifiedBy: ids.disabledId }],
      ["shared device account", { memberId: ids.sharedId }],
      ["not an id", { memberId: "not-a-real-id" }],
    ];
    for (const [label, overrides] of cases) {
      const res = await submit(baBody({ ...overrides, clientRequestId: `elig:${label}` }));
      expect(res.status, label).toBe(400);
    }
    const rows = await t.run((ctx) => ctx.db.query("baRecords").collect());
    expect(rows).toHaveLength(0);
  });

  it("holds dateUsed to the last 365 Melbourne days", async () => {
    const ok = [brigadeDateStr(0), brigadeDateStr(-365)];
    const bad = [brigadeDateStr(1), brigadeDateStr(-366), "2026-02-30", "25/11/2026", ""];
    for (const dateUsed of ok) {
      expect((await submit(baBody({ dateUsed, clientRequestId: `ok:${dateUsed}` }))).status, dateUsed).toBe(200);
    }
    for (const dateUsed of bad) {
      expect((await submit(baBody({ dateUsed, clientRequestId: `bad:${dateUsed}` }))).status, dateUsed).toBe(400);
    }
  });

  it("validates the rest of the body", async () => {
    const cases: Array<Record<string, unknown>> = [
      { clientRequestId: undefined },
      { clientRequestId: "" },
      { clientRequestId: "x".repeat(121) },
      { memberId: undefined },
      { verifiedBy: 12 },
      { durationMinutes: 0 },
      { durationMinutes: 481 },
      { durationMinutes: 12.5 },
      { durationMinutes: "30" },
      { usageType: "training" },
      { notes: "   " },
      { notes: "x".repeat(501) },
      { kioskDevice: "bad\ndevice" },
    ];
    for (const overrides of cases) {
      const res = await submit(baBody(overrides));
      expect(res.status, JSON.stringify(overrides)).toBe(400);
    }
    expect((await submit(baBody({ durationMinutes: 480, notes: "x".repeat(500) }))).status).toBe(200);
  });
});
