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

function enableControls(t: ReturnType<typeof convexTest>, adminId: string, siteId = "satellite") {
  return t
    .withIdentity({ subject: adminId })
    .mutation(api.accessControl.setSiteControls, { siteId, enabled: true });
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
    await enableControls(t, ids.admin);

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
    expect(dash.events.filter((e) => e.source === "panel")).toHaveLength(1);

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
    await enableControls(t, ids.admin);
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

  it("keeps remote controls off until an admin turns them on, and the bridge cannot override it", async () => {
    const { t, ids } = await setup();
    const asLt = t.withIdentity({ subject: ids.lt });
    const asAdmin = t.withIdentity({ subject: ids.admin });
    const push = (writesEnabled = true) =>
      bridgePost(
        t,
        "/api/access/state",
        { site: satellitePayload(Date.now(), { writesEnabled, areaStatus: "armed" }) },
        { site: "satellite", token: SAT_TOKEN },
      );
    const disarm = (who = asLt) =>
      who.mutation(api.accessControl.requestCommand, {
        siteId: "satellite",
        targetKind: "area",
        targetId: "sat-station",
        action: "disarm",
      });

    // Off by default, even with the bridge reporting writes on.
    await push();
    let dash = await asLt.query(api.accessControl.getDashboard, {});
    expect(dash.sites[0].controlsEnabled).toBe(false);
    expect(dash.canManageControls).toBe(false);
    await expect(disarm()).rejects.toThrow(/turned off/i);

    // Only admins can flip it, and only for a site that has reported in.
    await expect(
      asLt.mutation(api.accessControl.setSiteControls, { siteId: "satellite", enabled: true }),
    ).rejects.toThrow(/administrators/i);
    await expect(
      asAdmin.mutation(api.accessControl.setSiteControls, { siteId: "main", enabled: true }),
    ).rejects.toThrow(/reported in/i);
    expect((await asAdmin.query(api.accessControl.getDashboard, {})).canManageControls).toBe(true);

    await enableControls(t, ids.admin);
    await push();
    dash = await asLt.query(api.accessControl.getDashboard, {});
    expect(dash.sites[0].controlsEnabled).toBe(true);
    expect(dash.sites[0].controlsChangedBy).toBe("Alex Carter");

    // Turning it off fails what is queued, and the bridge push doesn't undo it.
    const queued = await disarm();
    await asAdmin.mutation(api.accessControl.setSiteControls, { siteId: "satellite", enabled: false });
    await push();
    dash = await asLt.query(api.accessControl.getDashboard, {});
    expect(dash.sites[0].controlsEnabled).toBe(false);
    const cmd = dash.recentCommands.find((c) => c.id === queued.commandId);
    expect(cmd?.status).toBe("failed");
    expect(dash.events.some((e) => e.text === "Remote controls turned off" && e.who === "Alex Carter")).toBe(true);
    const claimOff = await bridgePost(t, "/api/access/claim", {}, { site: "satellite", token: SAT_TOKEN });
    expect((await claimOff.json()).command).toBeNull();

    // The claim refuses too if the switch went off after a command was queued.
    await enableControls(t, ids.admin);
    vi.advanceTimersByTime(4_000);
    const raced = await disarm();
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("accessSiteControls")
        .withIndex("by_siteId", (q) => q.eq("siteId", "satellite"))
        .unique();
      await ctx.db.patch("accessSiteControls", row!._id, { controlsEnabled: false });
    });
    const claimRaced = await bridgePost(t, "/api/access/claim", {}, { site: "satellite", token: SAT_TOKEN });
    expect((await claimRaced.json()).command).toBeNull();
    dash = await asLt.query(api.accessControl.getDashboard, {});
    expect(dash.recentCommands.find((c) => c.id === raced.commandId)?.status).toBe("failed");
  });

  describe("server kill switch", () => {
    const disarm = (who: { mutation: ReturnType<typeof convexTest>["mutation"] }, siteId = "satellite") =>
      who.mutation(api.accessControl.requestCommand, {
        siteId,
        targetKind: "area",
        targetId: siteId === "main" ? "main-station" : "sat-station",
        action: "disarm",
      });

    async function twoSitesOn() {
      const { t, ids } = await setup();
      const now = Date.now();
      await bridgePost(t, "/api/access/state", { site: satellitePayload(now) }, { site: "satellite", token: SAT_TOKEN });
      await bridgePost(
        t,
        "/api/access/state",
        {
          site: {
            ...satellitePayload(now),
            name: "Main Station",
            panel: "inception",
            panelLabel: "Inner Range Inception",
            areas: [{ ...satellitePayload(now).areas[0], id: "main-station" }],
          },
        },
        { site: "main", token: MAIN_TOKEN },
      );
      await enableControls(t, ids.admin, "satellite");
      await enableControls(t, ids.admin, "main");
      return { t, ids };
    }

    const claim = async (t: ReturnType<typeof convexTest>, site = "satellite") => {
      const res = await bridgePost(t, "/api/access/claim", {}, { site, token: site === "main" ? MAIN_TOKEN : SAT_TOKEN });
      expect(res.status).toBe(200);
      return await res.json();
    };

    async function commandAndAudit(t: ReturnType<typeof convexTest>, commandId: string) {
      return await t.run(async (ctx) => {
        const cmd = await ctx.db.get(commandId as never);
        const audit = await ctx.db.query("accessAuditLog").collect();
        return { cmd: cmd as { status: string; message?: string } | null, audit: audit.filter((a) => a.commandId === commandId) };
      });
    }

    it("global switch refuses admins and members, audits it, and the bridge gets nothing", async () => {
      const { t, ids } = await twoSitesOn();
      vi.stubEnv("ACCESS_CONTROL_WRITES_DISABLED", "TRUE");

      for (const who of [t.withIdentity({ subject: ids.admin }), t.withIdentity({ subject: ids.lt })]) {
        for (const siteId of ["satellite", "main"]) {
          const res = await disarm(who, siteId);
          const { cmd, audit } = await commandAndAudit(t, res.commandId);
          expect(cmd?.status).toBe("failed");
          expect(cmd?.message).toMatch(/switched off in BRAVO for (Satellite|Main) Station/);
          expect(audit).toHaveLength(1);
          expect(audit[0].status).toBe("refused");
          vi.advanceTimersByTime(4_000);
        }
      }

      const body = await claim(t);
      expect(body.command).toBeNull();
      expect(body.writesDisabled).toBe(true);

      const dash = await t.withIdentity({ subject: ids.lt }).query(api.accessControl.getDashboard, {});
      for (const site of dash.sites) {
        expect(site.bravoWritesDisabled).toBe(true);
        expect(site.bravoWritesDisabledReason).toBe("allSites");
      }
    });

    it("per-site switch blocks only that site", async () => {
      const { t, ids } = await twoSitesOn();
      vi.stubEnv("ACCESS_CONTROL_WRITES_DISABLED_SATELLITE", "on");
      const asAdmin = t.withIdentity({ subject: ids.admin });

      const sat = await disarm(asAdmin, "satellite");
      expect((await commandAndAudit(t, sat.commandId)).cmd?.status).toBe("failed");
      const main = await disarm(asAdmin, "main");
      expect((await commandAndAudit(t, main.commandId)).cmd?.status).toBe("pending");

      const satClaim = await claim(t, "satellite");
      expect(satClaim).toMatchObject({ command: null, writesDisabled: true });
      const mainClaim = await claim(t, "main");
      expect(mainClaim.writesDisabled).toBe(false);
      expect(mainClaim.command.commandId).toBe(main.commandId);

      const dash = await asAdmin.query(api.accessControl.getDashboard, {});
      const byId = Object.fromEntries(dash.sites.map((s) => [s.id, s]));
      expect(byId.satellite.bravoWritesDisabled).toBe(true);
      expect(byId.satellite.bravoWritesDisabledReason).toBe("thisSite");
      expect(byId.main.bravoWritesDisabled).toBe(false);
      expect(byId.main.bravoWritesDisabledReason).toBeUndefined();
    });

    it("fails a command queued before the switch at once, and never hands it out after the switch is lifted", async () => {
      const { t, ids } = await twoSitesOn();
      const queued = await disarm(t.withIdentity({ subject: ids.lt }));

      vi.stubEnv("ACCESS_CONTROL_WRITES_DISABLED", "1");
      expect(await claim(t)).toMatchObject({ command: null, writesDisabled: true });
      const { cmd, audit } = await commandAndAudit(t, queued.commandId);
      expect(cmd?.status).toBe("failed");
      expect(cmd?.message).toBe("Remote control is switched off in BRAVO for Satellite Station");
      expect(audit.map((a) => a.status)).toEqual(["queued", "failed"]);

      // Lifting the switch, well inside the TTL, does not revive it.
      vi.stubEnv("ACCESS_CONTROL_WRITES_DISABLED", "");
      expect(await claim(t)).toMatchObject({ command: null, writesDisabled: false });
      expect((await commandAndAudit(t, queued.commandId)).cmd?.status).toBe("failed");
    });

    it("per-site switch fails only that site's queue, and the other site still gets its command", async () => {
      const { t, ids } = await twoSitesOn();
      const asLt = t.withIdentity({ subject: ids.lt });
      const sat = await disarm(asLt, "satellite");
      const main = await disarm(asLt, "main");

      vi.stubEnv("ACCESS_CONTROL_WRITES_DISABLED_SATELLITE", "yes");
      expect(await claim(t, "satellite")).toMatchObject({ command: null, writesDisabled: true });
      expect((await commandAndAudit(t, sat.commandId)).cmd?.status).toBe("failed");
      expect((await commandAndAudit(t, main.commandId)).cmd?.status).toBe("pending");

      vi.stubEnv("ACCESS_CONTROL_WRITES_DISABLED_SATELLITE", "no");
      expect(await claim(t, "satellite")).toMatchObject({ command: null, writesDisabled: false });
      const mainClaim = await claim(t, "main");
      expect(mainClaim.writesDisabled).toBe(false);
      expect(mainClaim.command.commandId).toBe(main.commandId);
    });

    it("leaves the normal path unchanged when the switch is off or not truthy", async () => {
      const { t, ids } = await twoSitesOn();
      vi.stubEnv("ACCESS_CONTROL_WRITES_DISABLED", "false");
      vi.stubEnv("ACCESS_CONTROL_WRITES_DISABLED_SATELLITE", "0");
      const queued = await disarm(t.withIdentity({ subject: ids.lt }));
      const { cmd, audit } = await commandAndAudit(t, queued.commandId);
      expect(cmd?.status).toBe("pending");
      expect(audit.map((a) => a.status)).toEqual(["queued"]);
      const body = await claim(t);
      expect(body.writesDisabled).toBe(false);
      expect(body.command.commandId).toBe(queued.commandId);
    });
  });

  it("never sends an email as the actor name", async () => {
    const { t, ids } = await setup();
    const emailOnly = await t.run((ctx) =>
      ctx.db.insert("users", { name: "riley.brooks@example.com", email: "riley.brooks@example.com", rank: "Captain" }),
    );
    const nameOnly = await t.run((ctx) => ctx.db.insert("users", { name: "Riley Brooks", rank: "Captain" }));
    await bridgePost(t, "/api/access/state", { site: satellitePayload(Date.now()) }, { site: "satellite", token: SAT_TOKEN });
    await enableControls(t, ids.admin);

    const send = (userId: string) =>
      t.withIdentity({ subject: userId }).mutation(api.accessControl.requestCommand, {
        siteId: "satellite",
        targetKind: "area",
        targetId: "sat-station",
        action: "disarm",
      });

    await send(emailOnly);
    const first = await bridgePost(t, "/api/access/claim", {}, { site: "satellite", token: SAT_TOKEN });
    const firstBody = await first.json();
    expect(firstBody.command.actorName).toBe("Member");
    await bridgePost(
      t,
      "/api/access/result",
      { commandId: firstBody.command.commandId, status: "succeeded" },
      { site: "satellite", token: SAT_TOKEN },
    );

    vi.advanceTimersByTime(4_000);
    await send(nameOnly);
    const second = await bridgePost(t, "/api/access/claim", {}, { site: "satellite", token: SAT_TOKEN });
    expect((await second.json()).command.actorName).toBe("Riley Brooks");

    const stored = await t.run(async (ctx) => {
      const cmds = await ctx.db.query("accessCommands").collect();
      const audit = await ctx.db.query("accessAuditLog").collect();
      const events = await ctx.db.query("accessEvents").collect();
      return [...cmds.map((c) => c.actorName), ...audit.map((a) => a.actorName), ...events.map((e) => e.who ?? "")];
    });
    expect(stored.some((n) => n.includes("@"))).toBe(false);
  });
});
