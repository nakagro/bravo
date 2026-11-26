// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { openModules } from "./moduleFixtures.testing";

const modules = import.meta.glob("./**/*.ts");
const MAIN_TOKEN = "kiosk-main-token-0123456789abcdef0123456789";
const SAT_TOKEN = "kiosk-sat-token-aaaabbbbccccddddeeeeffff0000";

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await openModules(ctx);
    await ctx.db.insert("moduleSettings", {
      moduleId: "turnoutControl",
      moduleName: "Turnout Control",
      isEnabled: true,
      adminOnly: false,
      superAdminOnly: true,
      requiredRoles: [],
      minimumRank: "Lieutenant",
      updatedAt: Date.now(),
    });
  });

  const ids = await t.run(async (ctx) => {
    const superAdmin = await ctx.db.insert("users", {
      firstName: "Morgan",
      lastName: "Shaw",
      email: "morgan@example.com",
      rank: "Captain",
      isAdmin: true,
      isSuperAdmin: true,
    });
    const admin = await ctx.db.insert("users", {
      firstName: "Alex",
      lastName: "Carter",
      email: "alex@example.com",
      rank: "Captain",
      isAdmin: true,
    });
    const member = await ctx.db.insert("users", {
      firstName: "Sam",
      lastName: "Taylor",
      email: "sam@example.com",
      rank: "Firefighter",
    });
    const disabledSuper = await ctx.db.insert("users", {
      firstName: "Casey",
      lastName: "Morgan",
      email: "casey@example.com",
      rank: "Captain",
      isAdmin: true,
      isSuperAdmin: true,
      isDisabled: true,
    });
    return { superAdmin, admin, member, disabledSuper };
  });

  return {
    t,
    ids,
    asSuperAdmin: t.withIdentity({ subject: ids.superAdmin }),
    asAdmin: t.withIdentity({ subject: ids.admin }),
    asMember: t.withIdentity({ subject: ids.member }),
    asDisabledSuper: t.withIdentity({ subject: ids.disabledSuper }),
  };
}

beforeEach(() => {
  vi.stubEnv("KIOSK_HUB_MAIN_TOKEN", MAIN_TOKEN);
  vi.stubEnv("KIOSK_HUB_SATELLITE_TOKEN", SAT_TOKEN);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("turnoutControl superAdminOnly access", () => {
  it("locks out regular admins, members, and disabled super admins while permitting active super admins", async () => {
    const { asSuperAdmin, asAdmin, asMember, asDisabledSuper } = await setup();

    expect((await asSuperAdmin.query(api.modules.getAllModuleAccess, {})).turnoutControl).toBe(true);
    expect((await asAdmin.query(api.modules.getAllModuleAccess, {})).turnoutControl).toBe(false);
    expect((await asMember.query(api.modules.getAllModuleAccess, {})).turnoutControl).toBe(false);
    expect((await asDisabledSuper.query(api.modules.getAllModuleAccess, {})).turnoutControl).toBe(
      false,
    );

    expect(await asSuperAdmin.query(api.turnoutControl.getState, {})).toMatchObject({
      siteId: "main",
      revision: 0,
      overrides: {},
      activeSimulation: null,
      recentAudit: [],
    });
    expect(await asAdmin.query(api.turnoutControl.getState, {})).toBeNull();
    expect(await asMember.query(api.turnoutControl.getState, {})).toBeNull();
    expect(await asDisabledSuper.query(api.turnoutControl.getState, {})).toBeNull();

    for (const caller of [asAdmin, asMember, asDisabledSuper]) {
      await expect(
        caller.mutation(api.turnoutControl.updateOverrides, {
          overrides: { isIdleScreenDisabled: true },
        }),
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.turnoutControl.resetOverrides, {}),
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.turnoutControl.startSimulation, {
          messageText: "ALERT WYDV1 TEST DRILL",
          address: "45 Ison Rd Werribee",
          ttlMinutes: 15,
        }),
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.turnoutControl.stopSimulation, {}),
      ).rejects.toThrow();
      await expect(
        caller.action(api.turnoutControl.searchAddress, { query: "45 Ison Rd" }),
      ).rejects.toThrow();
    }
  });

  it("allows an explicitly allowlisted user when enabled and revokes access when disabled", async () => {
    const { asSuperAdmin, asAdmin, ids } = await setup();

    await asSuperAdmin.mutation(api.modules.updateModuleRequirements, {
      moduleId: "turnoutControl",
      adminOnly: false,
      superAdminOnly: true,
      allowedUserIds: [ids.admin],
      requiredRoles: [],
      minimumRank: "Lieutenant",
    });

    expect((await asAdmin.query(api.modules.getAllModuleAccess, {})).turnoutControl).toBe(true);
    expect(await asAdmin.query(api.turnoutControl.getState, {})).not.toBeNull();
    await expect(
      asAdmin.mutation(api.turnoutControl.updateOverrides, {
        overrides: { forceMultiJobCount: 2 },
      }),
    ).resolves.toEqual({ revision: 1 });

    await asSuperAdmin.mutation(api.modules.updateModuleStatus, {
      moduleId: "turnoutControl",
      isEnabled: false,
    });
    expect(await asAdmin.query(api.turnoutControl.getState, {})).toBeNull();
    await expect(
      asAdmin.mutation(api.turnoutControl.resetOverrides, {}),
    ).rejects.toThrow();
  });
});

describe("turnoutControl overrides & audit", () => {
  it("validates, persists, and resets overrides without clearing an active simulation", async () => {
    const { asSuperAdmin } = await setup();

    await expect(
      asSuperAdmin.mutation(api.turnoutControl.updateOverrides, {
        overrides: { headerHeightSingle: 9 },
      }),
    ).rejects.toThrow(/10 to 60/);
    await expect(
      asSuperAdmin.mutation(api.turnoutControl.updateOverrides, {
        overrides: { headerHeightDouble: 61 },
      }),
    ).rejects.toThrow(/10 to 60/);
    await expect(
      asSuperAdmin.mutation(api.turnoutControl.updateOverrides, {
        overrides: { headerHeightTriple: 35.5 },
      }),
    ).rejects.toThrow(/whole number/);
    await expect(
      asSuperAdmin.mutation(api.turnoutControl.updateOverrides, {
        siteId: "Main!",
        overrides: {},
      }),
    ).rejects.toThrow(/Invalid siteId/);

    const r1 = await asSuperAdmin.mutation(api.turnoutControl.updateOverrides, {
      overrides: {
        isIdleScreenDisabled: true,
        forceMultiJobCount: 2,
        headerHeightSingle: 40,
        headerHeightDouble: 30,
        headerHeightTriple: 45,
      },
    });
    expect(r1).toEqual({ revision: 1 });

    const started = await asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
      messageText: "ALERT WYDV1 G&SC1 STRUCTURE FIRE 45 ISON RD WERRIBEE",
      address: "45 Ison Rd Werribee",
      ttlMinutes: 15,
    });
    expect(started.revision).toBe(2);

    const r3 = await asSuperAdmin.mutation(api.turnoutControl.resetOverrides, {});
    expect(r3).toEqual({ revision: 3 });

    const state = await asSuperAdmin.query(api.turnoutControl.getState, {});
    expect(state).toMatchObject({
      revision: 3,
      overrides: {},
      updatedByName: "Morgan Shaw",
    });
    expect(state?.activeSimulation).toMatchObject({
      id: started.simulationId,
      address: "45 Ison Rd Werribee",
      playAudio: false,
      startedByName: "Morgan Shaw",
    });
    expect(state?.recentAudit.map((a) => a.action)).toEqual([
      "resetOverrides",
      "startSimulation",
      "updateOverrides",
    ]);
  });
});

describe("turnoutControl training simulation lifecycle", () => {
  it("validates fields, defaults playAudio to false, and supports idempotent stop", async () => {
    const { asSuperAdmin } = await setup();

    await expect(
      asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
        messageText: "   ",
        address: "45 Ison Rd",
        ttlMinutes: 15,
      }),
    ).rejects.toThrow(/Pager message/);
    await expect(
      asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
        messageText: "x".repeat(501),
        address: "45 Ison Rd",
        ttlMinutes: 15,
      }),
    ).rejects.toThrow(/Pager message/);
    await expect(
      asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
        messageText: "ALERT WYDV1 TEST",
        address: "  ",
        ttlMinutes: 15,
      }),
    ).rejects.toThrow(/Address/);
    await expect(
      asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
        messageText: "ALERT WYDV1 TEST",
        address: "45 Ison Rd",
        coordinates: { latitude: -95, longitude: 144.6 },
        ttlMinutes: 15,
      }),
    ).rejects.toThrow(/Coordinates/);
    await expect(
      asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
        messageText: "ALERT WYDV1 TEST",
        address: "45 Ison Rd",
        ttlMinutes: 0,
      }),
    ).rejects.toThrow(/1 to 99/);
    await expect(
      asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
        messageText: "ALERT WYDV1 TEST",
        address: "45 Ison Rd",
        ttlMinutes: 100,
      }),
    ).rejects.toThrow(/1 to 99/);
    await expect(
      asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
        messageText: "ALERT WYDV1 TEST",
        address: "45 Ison Rd",
        ttlMinutes: 10.5,
      }),
    ).rejects.toThrow(/1 to 99/);

    // Custom 2-digit TTL (e.g. 10 min default or 45 min custom) is accepted.
    const quick = await asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
      messageText: "ALERT WYDV1 QUICK DRILL",
      address: "45 Ison Rd",
      ttlMinutes: 10,
    });
    expect(quick.revision).toBe(1);
    await asSuperAdmin.mutation(api.turnoutControl.stopSimulation, {});

    // Stopping when nothing is running is an idempotent no-op.
    expect(await asSuperAdmin.mutation(api.turnoutControl.stopSimulation, {})).toEqual({
      revision: 2,
      wasActive: false,
    });

    const started = await asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
      messageText: "  ALERT WYDV1 TEST DRILL  ",
      address: "  45 Ison Rd Werribee  ",
      coordinates: { latitude: -37.89123, longitude: 144.62346 },
      ttlMinutes: 45,
      playAudio: true,
    });
    expect(started.revision).toBe(3);

    const activeState = await asSuperAdmin.query(api.turnoutControl.getState, {});
    expect(activeState?.activeSimulation).toMatchObject({
      id: started.simulationId,
      messageText: "ALERT WYDV1 TEST DRILL",
      address: "45 Ison Rd Werribee",
      coordinates: { latitude: -37.89123, longitude: 144.62346 },
      playAudio: true,
      startedByName: "Morgan Shaw",
    });
    expect(
      activeState!.activeSimulation!.expiresAt - activeState!.activeSimulation!.startedAt,
    ).toBe(45 * 60_000);

    const stopped = await asSuperAdmin.mutation(api.turnoutControl.stopSimulation, {});
    expect(stopped).toEqual({ revision: 4, wasActive: true });

    const stoppedState = await asSuperAdmin.query(api.turnoutControl.getState, {});
    expect(stoppedState?.activeSimulation).toBeNull();
    expect(stoppedState?.recentAudit[0]).toMatchObject({
      action: "stopSimulation",
      actorName: "Morgan Shaw",
      revision: 4,
    });
  });

  it("auto-expires a simulation via scheduled mutation and ignores stale expiry jobs", async () => {
    vi.useFakeTimers();
    const { t, asSuperAdmin } = await setup();

    const first = await asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
      messageText: "ALERT WYDV1 FIRST DRILL",
      address: "10 First St",
      ttlMinutes: 15,
    });
    // Replacing with a second simulation must prevent the first timer from expiring the second.
    const second = await asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
      messageText: "ALERT WYDV1 SECOND DRILL",
      address: "20 Second St",
      ttlMinutes: 60,
    });

    const staleExpired = await t.mutation(internal.turnoutControl.expireSimulationIfDue, {
      siteId: "main",
      simulationId: first.simulationId,
    });
    expect(staleExpired).toBe(false);

    const stillActive = await asSuperAdmin.query(api.turnoutControl.getState, {});
    expect(stillActive?.activeSimulation?.id).toBe(second.simulationId);

    // Let scheduled expiry run when TTL elapses.
    vi.advanceTimersByTime(60 * 60_000 + 1_000);
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const afterExpiry = await asSuperAdmin.query(api.turnoutControl.getState, {});
    expect(afterExpiry?.activeSimulation).toBeNull();
    expect(afterExpiry?.recentAudit[0]).toMatchObject({
      action: "expireSimulation",
      actorName: "System (TTL Expiry)",
    });
  });
});

describe("kioskApi turnoutControl delivery", () => {
  it("pushes turnoutControl over watchAppliances and /api/kiosk/v1/sync scoped per site, omitting internal user IDs", async () => {
    const { t, asSuperAdmin } = await setup();

    const syncHeaders = {
      "X-Kiosk-Site": "main",
      Authorization: `Bearer ${MAIN_TOKEN}`,
    };
    const beforeRes = await t.fetch("/api/kiosk/v1/sync?scope=appliances", {
      headers: syncHeaders,
    });
    const beforeEtag = beforeRes.headers.get("ETag")!;
    const beforeBody = await beforeRes.json();
    expect(beforeBody.turnoutControl).toEqual({
      revision: 0,
      overrides: {},
      activeSimulation: null,
      updatedAt: 0,
    });

    await asSuperAdmin.mutation(api.turnoutControl.updateOverrides, {
      siteId: "main",
      overrides: { isIdleScreenDisabled: true, headerHeightSingle: 42 },
    });
    const sim = await asSuperAdmin.mutation(api.turnoutControl.startSimulation, {
      siteId: "main",
      messageText: "ALERT WYDV1 DRILL",
      address: "45 Ison Rd Werribee",
      ttlMinutes: 15,
    });

    // Live WebSocket query for main receives the state without startedBy.
    const liveMain = await t.query(api.kioskApi.watchAppliances, {
      siteId: "main",
      token: MAIN_TOKEN,
    });
    expect(liveMain.turnoutControl).toMatchObject({
      revision: 2,
      overrides: { isIdleScreenDisabled: true, headerHeightSingle: 42 },
      activeSimulation: {
        id: sim.simulationId,
        messageText: "ALERT WYDV1 DRILL",
        address: "45 Ison Rd Werribee",
        playAudio: false,
        startedByName: "Morgan Shaw",
      },
    });
    expect("startedBy" in (liveMain.turnoutControl.activeSimulation as object)).toBe(false);

    // Satellite site stays isolated with its own zero state.
    const liveSat = await t.query(api.kioskApi.watchAppliances, {
      siteId: "satellite",
      token: SAT_TOKEN,
    });
    expect(liveSat.turnoutControl).toEqual({
      revision: 0,
      overrides: {},
      activeSimulation: null,
      updatedAt: 0,
    });

    // HTTP /sync ETag invalidates and returns matching payload.
    const afterRes = await t.fetch("/api/kiosk/v1/sync?scope=appliances", {
      headers: { ...syncHeaders, "If-None-Match": beforeEtag },
    });
    expect(afterRes.status).toBe(200);
    expect(afterRes.headers.get("ETag")).not.toBe(beforeEtag);
    const afterBody = await afterRes.json();
    expect(afterBody.turnoutControl).toEqual(liveMain.turnoutControl);
  });
});
