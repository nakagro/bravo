// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SAT_TOKEN = "sat-bridge-secret-0123456789abcdef0123456789";
const MAIN_TOKEN = "main-bridge-secret-fedcba9876543210fedcba9876";

function bridgePost(
  t: ReturnType<typeof convexTest>,
  path: string,
  body: unknown,
  opts: { site?: string; token?: string } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.site !== undefined) headers["X-Access-Site"] = opts.site;
  if (opts.token !== undefined) headers.Authorization = `Bearer ${opts.token}`;
  return t.fetch(path, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function satellitePayload(
  now: number,
  overrides: {
    writesEnabled?: boolean;
    areaStatus?: "armed" | "disarmed";
    rollerStatus?: "secured" | "open";
    rollerCanControl?: boolean;
  } = {},
) {
  return {
    name: "Satellite Station",
    panel: "challenger" as const,
    panelLabel: "Tecom Challenger+",
    writesEnabled: overrides.writesEnabled ?? true,
    bridgeVersion: "0.1.0",
    areas: [
      {
        id: "sat-station",
        name: "Station",
        status: overrides.areaStatus ?? "armed",
        changedAt: now - 60_000,
        changedBy: "Alex Carter",
        canControl: true,
      },
    ],
    doors: [
      {
        id: "sat-front",
        name: "Front Door",
        kind: "door" as const,
        status: "secured" as const,
        changedAt: now - 60_000,
        canControl: true,
        supportsHold: false,
      },
      {
        id: "sat-roller-1",
        name: "Roller Door",
        kind: "roller" as const,
        status: overrides.rollerStatus ?? "secured",
        changedAt: now - 60_000,
        canControl: overrides.rollerCanControl ?? true,
        supportsHold: false,
      },
    ],
  };
}

async function setup() {
  vi.stubEnv("ACCESS_BRIDGE_SATELLITE_TOKEN", SAT_TOKEN);
  vi.stubEnv("ACCESS_BRIDGE_MAIN_TOKEN", MAIN_TOKEN);
  const t = convexTest(schema, modules);

  const ids = await t.run(async (ctx) => {
    await ctx.db.insert("moduleSettings", {
      moduleId: "accessControl",
      moduleName: "Access Control",
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      minimumRank: "Lieutenant",
      updatedAt: Date.now(),
    });
    const ff = await ctx.db.insert("users", {
      firstName: "Sam",
      lastName: "Taylor",
      rank: "Firefighter",
    });
    const lt = await ctx.db.insert("users", {
      firstName: "Jordan",
      lastName: "Lee",
      rank: "Lieutenant",
    });
    const disabledLt = await ctx.db.insert("users", {
      firstName: "Casey",
      lastName: "Morgan",
      rank: "Lieutenant",
      isDisabled: true,
    });
    const sharedLt = await ctx.db.insert("users", {
      firstName: "Station",
      lastName: "Kiosk",
      rank: "Lieutenant",
      accountType: "shared",
    });
    const admin = await ctx.db.insert("users", {
      firstName: "Alex",
      lastName: "Carter",
      rank: "Captain",
      isAdmin: true,
    });
    return { ff, lt, disabledLt, sharedLt, admin };
  });

  return { t, ids };
}

describe("accessControl RBAC and bridge contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("gates dashboard and commands to active Lieutenant+ members and admins", async () => {
    const { t, ids } = await setup();

    await expect(t.query(api.accessControl.getDashboard, {})).rejects.toThrow(/signed in/i);

    const asFf = t.withIdentity({ subject: ids.ff });
    await expect(asFf.query(api.accessControl.getDashboard, {})).rejects.toThrow(/Lieutenant/i);

    const asDisabled = t.withIdentity({ subject: ids.disabledLt });
    await expect(asDisabled.query(api.accessControl.getDashboard, {})).rejects.toThrow();

    const asShared = t.withIdentity({ subject: ids.sharedLt });
    await expect(asShared.query(api.accessControl.getDashboard, {})).rejects.toThrow(/active member/i);

    const asLt = t.withIdentity({ subject: ids.lt });
    const ltDash = await asLt.query(api.accessControl.getDashboard, {});
    expect(ltDash.sites).toEqual([]);

    const asAdmin = t.withIdentity({ subject: ids.admin });
    const adminDash = await asAdmin.query(api.accessControl.getDashboard, {});
    expect(adminDash.sites).toEqual([]);
  });

  it("enforces per-site Bearer auth and fails closed on bridge endpoints", async () => {
    const { t } = await setup();
    const now = Date.now();
    const body = { site: satellitePayload(now) };

    expect((await bridgePost(t, "/api/access/state", body)).status).toBe(401);
    expect((await bridgePost(t, "/api/access/state", body, { site: "satellite", token: "wrong" })).status).toBe(401);
    // Cross-site token must be rejected.
    expect((await bridgePost(t, "/api/access/state", body, { site: "main", token: SAT_TOKEN })).status).toBe(401);
    expect((await bridgePost(t, "/api/access/state", "{bad", { site: "satellite", token: SAT_TOKEN })).status).toBe(400);

    vi.stubEnv("ACCESS_BRIDGE_SATELLITE_TOKEN", "");
    expect((await bridgePost(t, "/api/access/state", body, { site: "satellite", token: "" })).status).toBe(401);
  });

  it("ingests site state, deduplicates events, and completes a command lifecycle", async () => {
    const { t, ids } = await setup();
    const now = Date.now();

    const push1 = await bridgePost(
      t,
      "/api/access/state",
      {
        site: satellitePayload(now),
        events: [{ externalId: "challenger:546", at: now - 30_000, text: "Station armed" }],
      },
      { site: "satellite", token: SAT_TOKEN },
    );
    expect(push1.status).toBe(200);

    // Push same event again to verify dedupe.
    await bridgePost(
      t,
      "/api/access/state",
      {
        site: satellitePayload(now),
        events: [{ externalId: "challenger:546", at: now - 30_000, text: "Station armed" }],
      },
      { site: "satellite", token: SAT_TOKEN },
    );

    const asLt = t.withIdentity({ subject: ids.lt });
    const dash = await asLt.query(api.accessControl.getDashboard, {});
    expect(dash.sites).toHaveLength(1);
    expect(dash.sites[0].id).toBe("satellite");
    expect(dash.events).toHaveLength(1);

    // Queue Disarm & Open Roller Door.
    const queued = await asLt.mutation(api.accessControl.requestCommand, {
      siteId: "satellite",
      targetKind: "roller",
      targetId: "sat-roller-1",
      action: "disarm_and_open_roller",
      pulseMs: 500,
    });
    expect(queued.expiresAt).toBe(now + 15_000);

    // Bridge atomically claims command; second claim returns null.
    const claim1 = await bridgePost(t, "/api/access/claim", {}, { site: "satellite", token: SAT_TOKEN });
    expect(claim1.status).toBe(200);
    const claim1Body = await claim1.json();
    expect(claim1Body.command.commandId).toBe(queued.commandId);
    expect(claim1Body.command.actorName).toBe("Jordan Lee");

    const claim2 = await bridgePost(t, "/api/access/claim", {}, { site: "satellite", token: SAT_TOKEN });
    expect((await claim2.json()).command).toBeNull();

    // Bridge posts completion + fresh state.
    const done = await bridgePost(
      t,
      "/api/access/result",
      {
        commandId: queued.commandId,
        status: "succeeded",
        message: "Area 1 disarmed and Roller Door pulsed (500ms)",
        site: satellitePayload(Date.now(), { areaStatus: "disarmed", rollerStatus: "open" }),
      },
      { site: "satellite", token: SAT_TOKEN },
    );
    expect(done.status).toBe(200);

    const after = await asLt.query(api.accessControl.getDashboard, {});
    expect(after.sites[0].areas[0].status).toBe("disarmed");
    expect(after.sites[0].doors[1].status).toBe("open");
    expect(after.recentCommands[0].status).toBe("succeeded");
    expect(after.events.some((e) => e.source === "bravo" && e.who === "Jordan Lee")).toBe(true);
  });

  it("enforces safety guards: read-only, stale site, armed interlock, roller already open, and 15s TTL", async () => {
    const { t, ids } = await setup();
    const asLt = t.withIdentity({ subject: ids.lt });

    // 1. Read-only bridge rejects commands.
    await bridgePost(
      t,
      "/api/access/state",
      { site: satellitePayload(Date.now(), { writesEnabled: false }) },
      { site: "satellite", token: SAT_TOKEN },
    );
    await expect(
      asLt.mutation(api.accessControl.requestCommand, {
        siteId: "satellite",
        targetKind: "area",
        targetId: "sat-station",
        action: "disarm",
      }),
    ).rejects.toThrow(/read-only/i);

    // 2. Armed interlock blocks plain open_roller.
    await bridgePost(
      t,
      "/api/access/state",
      { site: satellitePayload(Date.now(), { writesEnabled: true, areaStatus: "armed" }) },
      { site: "satellite", token: SAT_TOKEN },
    );
    await expect(
      asLt.mutation(api.accessControl.requestCommand, {
        siteId: "satellite",
        targetKind: "roller",
        targetId: "sat-roller-1",
        action: "open_roller",
      }),
    ).rejects.toThrow(/armed/i);

    // 3. Roller already open blocks remote open/toggle.
    await bridgePost(
      t,
      "/api/access/state",
      { site: satellitePayload(Date.now(), { areaStatus: "disarmed", rollerStatus: "open" }) },
      { site: "satellite", token: SAT_TOKEN },
    );
    await expect(
      asLt.mutation(api.accessControl.requestCommand, {
        siteId: "satellite",
        targetKind: "roller",
        targetId: "sat-roller-1",
        action: "open_roller",
      }),
    ).rejects.toThrow(/already open/i);

    // 4. Expired command (> 15s) is never claimed by bridge.
    await bridgePost(
      t,
      "/api/access/state",
      { site: satellitePayload(Date.now(), { areaStatus: "armed", rollerStatus: "secured" }) },
      { site: "satellite", token: SAT_TOKEN },
    );
    await asLt.mutation(api.accessControl.requestCommand, {
      siteId: "satellite",
      targetKind: "area",
      targetId: "sat-station",
      action: "disarm",
    });
    vi.advanceTimersByTime(16_000);
    const claimExpired = await bridgePost(t, "/api/access/claim", {}, { site: "satellite", token: SAT_TOKEN });
    expect((await claimExpired.json()).command).toBeNull();
    const afterExpire = await asLt.query(api.accessControl.getDashboard, {});
    expect(afterExpire.recentCommands[0].status).toBe("expired");

    // 5. Stale site (> 2 min) rejects new commands.
    vi.advanceTimersByTime(125_000);
    await expect(
      asLt.mutation(api.accessControl.requestCommand, {
        siteId: "satellite",
        targetKind: "area",
        targetId: "sat-station",
        action: "disarm",
      }),
    ).rejects.toThrow(/offline/i);
  });
});
