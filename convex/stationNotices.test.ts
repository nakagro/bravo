// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const MAIN_TOKEN = "kiosk-main-token-0123456789abcdef0123456789";

type T = ReturnType<typeof convexTest>;

function kioskFetch(
  t: T,
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown; token?: string | null } = {},
) {
  const headers: Record<string, string> = { "X-Kiosk-Site": "main" };
  const token = opts.token === undefined ? MAIN_TOKEN : opts.token;
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  return t.fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
}

async function seed(t: T) {
  return t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("moduleSettings", {
      moduleId: "baSkills",
      moduleName: "BA",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      minimumRank: "Probationary",
      updatedAt: now,
    });
    const memberId = await ctx.db.insert("users", {
      firstName: "Jane",
      lastName: "Smith",
      rank: "Firefighter",
    });
    const outsiderId = await ctx.db.insert("users", {
      firstName: "Guest",
      lastName: "User",
      rank: "Brigade Member",
    });
    return { memberId, outsiderId };
  });
}

let t: T;
let ids: Awaited<ReturnType<typeof seed>>;

beforeEach(async () => {
  vi.stubEnv("KIOSK_HUB_MAIN_TOKEN", MAIN_TOKEN);
  t = convexTest(schema, modules);
  ids = await seed(t);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("BA cylinder station notices (BRAVO <-> kiosk-hub)", () => {
  it("allows BA members to flag, update, and clear cylinders while gating non-BA users", async () => {
    const asMember = t.withIdentity({ subject: ids.memberId });
    const asOutsider = t.withIdentity({ subject: ids.outsiderId });

    expect(await asOutsider.query(api.stationNotices.getBaCylindersNotice, {})).toBeNull();
    await expect(
      asOutsider.mutation(api.stationNotices.setBaCylindersNotice, { count: 2 }),
    ).rejects.toThrow();

    await asMember.mutation(api.stationNotices.setBaCylindersNotice, {
      count: 3,
      detail: "Used at drill",
    });
    const first = await asMember.query(api.stationNotices.getBaCylindersNotice, {});
    expect(first).toMatchObject({
      key: "ba_cylinders_refill",
      title: "Empty BA Cylinders",
      detail: "Used at drill",
      count: 3,
      active: true,
      updatedBySource: "user",
      updatedByName: "Jane Smith",
    });

    await asMember.mutation(api.stationNotices.setBaCylindersNotice, {
      count: 5,
      detail: "Structure fire",
    });
    const updated = await asMember.query(api.stationNotices.getBaCylindersNotice, {});
    expect(updated?.count).toBe(5);
    expect(updated?.createdAt).toBe(first?.createdAt);

    // Live watchAppliances query and HTTP /sync expose active stationNotices.
    const watched = await t.query(api.kioskApi.watchAppliances, {
      siteId: "main",
      token: MAIN_TOKEN,
    });
    expect(watched.stationNotices).toHaveLength(1);
    expect(watched.stationNotices[0]).toMatchObject({
      key: "ba_cylinders_refill",
      count: 5,
      source: "bravo",
      updatedBy: "Jane Smith",
    });

    const syncRes = await kioskFetch(t, "/api/kiosk/v1/sync?scope=appliances");
    expect(syncRes.status).toBe(200);
    const syncBody = await syncRes.json();
    expect(syncBody.stationNotices).toHaveLength(1);
    expect(syncBody.stationNotices[0].count).toBe(5);

    await asMember.mutation(api.stationNotices.clearBaCylindersNotice, {});
    const cleared = await asMember.query(api.stationNotices.getBaCylindersNotice, {});
    expect(cleared?.active).toBe(false);
    expect(cleared?.updatedByName).toBe("Jane Smith");

    const watchedAfterClear = await t.query(api.kioskApi.watchAppliances, {
      siteId: "main",
      token: MAIN_TOKEN,
    });
    expect(watchedAfterClear.stationNotices).toEqual([]);
  });

  it("accepts kiosk-hub notice syncs and rejects stale offline writes", async () => {
    const now = Date.now();
    const putRes = await kioskFetch(t, "/api/kiosk/v1/station-notice", {
      body: {
        key: "ba_cylinders_refill",
        active: true,
        title: "BA Cylinders Need Filling",
        detail: "2 cylinders used",
        severity: "warning",
        count: 2,
        kioskDevice: "KIOSK01",
        occurredAt: now - 1000,
        sentAt: now,
      },
    });
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.applied).toBe(true);
    expect(putBody.notice).toMatchObject({
      key: "ba_cylinders_refill",
      active: true,
      count: 2,
      updatedBy: "KIOSK01",
    });

    const asMember = t.withIdentity({ subject: ids.memberId });
    const view = await asMember.query(api.stationNotices.getBaCylindersNotice, {});
    expect(view).toMatchObject({
      active: true,
      count: 2,
      updatedBySource: "kioskHub",
      updatedByName: "KIOSK01",
    });

    // Phone updates to 4 cylinders.
    await asMember.mutation(api.stationNotices.setBaCylindersNotice, { count: 4 });

    // Stale offline clear from a kiosk (occurred 60s before send) must not clobber the newer phone update.
    const staleClear = await kioskFetch(t, "/api/kiosk/v1/station-notice", {
      body: {
        key: "ba_cylinders_refill",
        active: false,
        kioskDevice: "KIOSK02",
        occurredAt: now - 60_000,
        sentAt: now,
      },
    });
    expect(staleClear.status).toBe(200);
    const staleBody = await staleClear.json();
    expect(staleBody.applied).toBe(false);
    expect(staleBody.notice).toMatchObject({ active: true, count: 4 });

    // Rejects alert severity and bad keys.
    const badSeverity = await kioskFetch(t, "/api/kiosk/v1/station-notice", {
      body: {
        key: "ba_cylinders_refill",
        active: true,
        title: "No alerts",
        severity: "alert",
      },
    });
    expect(badSeverity.status).toBe(400);

    // Respects kill switch.
    vi.stubEnv("KIOSK_HUB_WRITES_DISABLED", "true");
    const blocked = await kioskFetch(t, "/api/kiosk/v1/station-notice", {
      body: { key: "ba_cylinders_refill", active: false },
    });
    expect(blocked.status).toBe(503);
  });
});
