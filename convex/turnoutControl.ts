import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getModuleUser, randomToken, requireModule } from "./lib/access";
import {
  TURNOUT_AUDIT_PAGE_LIMIT,
  TURNOUT_DEFAULT_SITE_ID,
  TURNOUT_HEADER_HEIGHT_MAX,
  TURNOUT_HEADER_HEIGHT_MIN,
  TURNOUT_SIM_ADDRESS_MAX,
  TURNOUT_SIM_MAX_TTL_MINUTES,
  TURNOUT_SIM_MESSAGE_MAX,
  TURNOUT_SITE_ID_RE,
  turnoutAuditActionValidator,
  turnoutControlWireValidator,
  turnoutCoordinatesValidator,
  turnoutOverridesValidator,
  turnoutSimTtlValidator,
  turnoutSimulationWireValidator,
} from "./lib/turnoutControlValidators";

const MODULE_ID = "turnoutControl";

function resolveSiteId(raw?: string): string {
  const siteId = (raw ?? TURNOUT_DEFAULT_SITE_ID).trim();
  if (!TURNOUT_SITE_ID_RE.test(siteId)) {
    throw new ConvexError("Invalid siteId");
  }
  return siteId;
}

function userDisplayName(user: Doc<"users">): string {
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return full || user.name || "Unknown";
}

function validateHeaderHeight(label: string, value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (
    !Number.isInteger(value) ||
    value < TURNOUT_HEADER_HEIGHT_MIN ||
    value > TURNOUT_HEADER_HEIGHT_MAX
  ) {
    throw new ConvexError(
      `${label} must be a whole number from ${TURNOUT_HEADER_HEIGHT_MIN} to ${TURNOUT_HEADER_HEIGHT_MAX}`,
    );
  }
  return value;
}

type TurnoutOverridesInput = {
  isIdleScreenDisabled?: boolean;
  forceMultiJobCount?: 0 | 2 | 3;
  headerHeightSingle?: number;
  headerHeightDouble?: number;
  headerHeightTriple?: number;
};

function normalizeOverrides(input: TurnoutOverridesInput): TurnoutOverridesInput {
  const out: TurnoutOverridesInput = {};
  if (input.isIdleScreenDisabled !== undefined) {
    out.isIdleScreenDisabled = input.isIdleScreenDisabled;
  }
  if (input.forceMultiJobCount !== undefined) {
    out.forceMultiJobCount = input.forceMultiJobCount;
  }
  const single = validateHeaderHeight("Single header height", input.headerHeightSingle);
  if (single !== undefined) out.headerHeightSingle = single;
  const doubleH = validateHeaderHeight("Double header height", input.headerHeightDouble);
  if (doubleH !== undefined) out.headerHeightDouble = doubleH;
  const triple = validateHeaderHeight("Triple header height", input.headerHeightTriple);
  if (triple !== undefined) out.headerHeightTriple = triple;
  return out;
}

function summarizeOverrides(overrides: TurnoutOverridesInput): string {
  const parts: string[] = [];
  if (overrides.isIdleScreenDisabled !== undefined) {
    parts.push(`Disable Idle Screen ${overrides.isIdleScreenDisabled ? "ON" : "OFF"}`);
  }
  if (overrides.forceMultiJobCount !== undefined) {
    const label =
      overrides.forceMultiJobCount === 0
        ? "Off"
        : overrides.forceMultiJobCount === 2
          ? "Double"
          : "Triple";
    parts.push(`Multi-Job ${label}`);
  }
  if (overrides.headerHeightSingle !== undefined) {
    parts.push(`Single Header ${overrides.headerHeightSingle}%`);
  }
  if (overrides.headerHeightDouble !== undefined) {
    parts.push(`Double Header ${overrides.headerHeightDouble}%`);
  }
  if (overrides.headerHeightTriple !== undefined) {
    parts.push(`Triple Header ${overrides.headerHeightTriple}%`);
  }
  return parts.length > 0 ? `Updated overrides: ${parts.join(", ")}` : "Cleared all display overrides";
}

function toWireSimulation(sim: NonNullable<Doc<"turnoutControl">["activeSimulation"]>) {
  return {
    id: sim.id,
    messageText: sim.messageText,
    address: sim.address,
    ...(sim.coordinates !== undefined ? { coordinates: sim.coordinates } : {}),
    playAudio: sim.playAudio,
    startedAt: sim.startedAt,
    expiresAt: sim.expiresAt,
    startedByName: sim.startedByName,
  };
}

/**
 * Shared read helper used by `convex/kioskApi.ts` (`watchAppliances` & `getSyncSnapshot`).
 * Returns a deterministic empty state when no row has been written for `siteId` yet.
 */
export async function turnoutControlSnapshot(ctx: QueryCtx, siteId: string) {
  const row = await ctx.db
    .query("turnoutControl")
    .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
    .unique();
  if (!row) {
    return {
      revision: 0,
      overrides: {},
      activeSimulation: null,
      updatedAt: 0,
    };
  }
  return {
    revision: row.revision,
    overrides: row.overrides,
    activeSimulation: row.activeSimulation ? toWireSimulation(row.activeSimulation) : null,
    updatedAt: row.updatedAt,
  };
}

const auditItemOut = v.object({
  id: v.id("turnoutControlAudit"),
  action: turnoutAuditActionValidator,
  actorName: v.string(),
  summary: v.string(),
  revision: v.number(),
  createdAt: v.number(),
});

const hubStatusOut = v.object({
  lastSyncAt: v.number(),
  buildId: v.optional(v.string()),
});

const turnoutControlStateOut = v.object({
  siteId: v.string(),
  revision: v.number(),
  overrides: turnoutOverridesValidator,
  activeSimulation: v.union(v.null(), turnoutSimulationWireValidator),
  updatedAt: v.number(),
  updatedByName: v.optional(v.string()),
  hubStatus: v.union(v.null(), hubStatusOut),
  recentAudit: v.array(auditItemOut),
});

/** Current Turnout Control state, hub heartbeat, and recent audit trail for the Super Admin UI. */
export const getState = query({
  args: {
    siteId: v.optional(v.string()),
  },
  returns: v.union(v.null(), turnoutControlStateOut),
  handler: async (ctx, args) => {
    const viewer = await getModuleUser(ctx, MODULE_ID);
    if (!viewer) return null;

    const siteId = resolveSiteId(args.siteId);
    const [row, hub, auditRows] = await Promise.all([
      ctx.db
        .query("turnoutControl")
        .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
        .unique(),
      ctx.db
        .query("kioskHubStatus")
        .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
        .first(),
      ctx.db
        .query("turnoutControlAudit")
        .withIndex("by_siteId_and_createdAt", (q) => q.eq("siteId", siteId))
        .order("desc")
        .take(TURNOUT_AUDIT_PAGE_LIMIT),
    ]);

    return {
      siteId,
      revision: row?.revision ?? 0,
      overrides: row?.overrides ?? {},
      activeSimulation: row?.activeSimulation ? toWireSimulation(row.activeSimulation) : null,
      updatedAt: row?.updatedAt ?? 0,
      ...(row?.updatedByName !== undefined ? { updatedByName: row.updatedByName } : {}),
      hubStatus: hub
        ? {
            lastSyncAt: hub.lastSyncAt,
            ...(hub.buildId !== undefined ? { buildId: hub.buildId } : {}),
          }
        : null,
      recentAudit: auditRows.map((entry) => ({
        id: entry._id,
        action: entry.action,
        actorName: entry.actorName,
        summary: entry.summary,
        revision: entry.revision,
        createdAt: entry.createdAt,
      })),
    };
  },
});

/** Update remote display overrides for a station turnout screen. */
export const updateOverrides = mutation({
  args: {
    siteId: v.optional(v.string()),
    overrides: turnoutOverridesValidator,
  },
  returns: v.object({ revision: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireModule(
      ctx,
      MODULE_ID,
      "Only authorised Turnout Control administrators can update display overrides",
    );

    const siteId = resolveSiteId(args.siteId);
    const overrides = normalizeOverrides(args.overrides);
    const now = Date.now();
    const actorName = userDisplayName(user);

    const existing = await ctx.db
      .query("turnoutControl")
      .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
      .unique();
    const revision = (existing?.revision ?? 0) + 1;

    if (existing) {
      await ctx.db.patch("turnoutControl", existing._id, {
        revision,
        overrides,
        updatedAt: now,
        updatedBy: user._id,
        updatedByName: actorName,
      });
    } else {
      await ctx.db.insert("turnoutControl", {
        siteId,
        revision,
        overrides,
        updatedAt: now,
        updatedBy: user._id,
        updatedByName: actorName,
      });
    }

    await ctx.db.insert("turnoutControlAudit", {
      siteId,
      action: "updateOverrides",
      actorId: user._id,
      actorName,
      summary: summarizeOverrides(overrides),
      revision,
      createdAt: now,
    });

    return { revision };
  },
});

/** Clear all remote display overrides back to local display defaults (leaves any active simulation untouched). */
export const resetOverrides = mutation({
  args: {
    siteId: v.optional(v.string()),
  },
  returns: v.object({ revision: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireModule(
      ctx,
      MODULE_ID,
      "Only authorised Turnout Control administrators can reset display overrides",
    );

    const siteId = resolveSiteId(args.siteId);
    const now = Date.now();
    const actorName = userDisplayName(user);

    const existing = await ctx.db
      .query("turnoutControl")
      .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
      .unique();
    const revision = (existing?.revision ?? 0) + 1;

    if (existing) {
      await ctx.db.patch("turnoutControl", existing._id, {
        revision,
        overrides: {},
        updatedAt: now,
        updatedBy: user._id,
        updatedByName: actorName,
      });
    } else {
      await ctx.db.insert("turnoutControl", {
        siteId,
        revision,
        overrides: {},
        updatedAt: now,
        updatedBy: user._id,
        updatedByName: actorName,
      });
    }

    await ctx.db.insert("turnoutControlAudit", {
      siteId,
      action: "resetOverrides",
      actorId: user._id,
      actorName,
      summary: "Reset remote display overrides to local defaults",
      revision,
      createdAt: now,
    });

    return { revision };
  },
});

/** Start (or replace) a bounded training job simulation on the turnout screen. */
export const startSimulation = mutation({
  args: {
    siteId: v.optional(v.string()),
    messageText: v.string(),
    address: v.string(),
    coordinates: v.optional(turnoutCoordinatesValidator),
    ttlMinutes: turnoutSimTtlValidator,
    playAudio: v.optional(v.boolean()),
  },
  returns: v.object({
    revision: v.number(),
    simulationId: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireModule(
      ctx,
      MODULE_ID,
      "Only authorised Turnout Control administrators can start a training simulation",
    );

    const siteId = resolveSiteId(args.siteId);
    const messageText = args.messageText.trim();
    if (messageText.length === 0 || messageText.length > TURNOUT_SIM_MESSAGE_MAX) {
      throw new ConvexError(`Pager message must be 1-${TURNOUT_SIM_MESSAGE_MAX} characters`);
    }
    const address = args.address.trim();
    if (address.length === 0 || address.length > TURNOUT_SIM_ADDRESS_MAX) {
      throw new ConvexError(`Address must be 1-${TURNOUT_SIM_ADDRESS_MAX} characters`);
    }

    let coordinates: { latitude: number; longitude: number } | undefined;
    if (args.coordinates !== undefined) {
      const { latitude, longitude } = args.coordinates;
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new ConvexError("Coordinates must be valid latitude (-90..90) and longitude (-180..180)");
      }
      coordinates = { latitude, longitude };
    }

    if (args.ttlMinutes > TURNOUT_SIM_MAX_TTL_MINUTES) {
      throw new ConvexError(`Simulation TTL cannot exceed ${TURNOUT_SIM_MAX_TTL_MINUTES} minutes`);
    }

    const playAudio = args.playAudio === true;
    const now = Date.now();
    const expiresAt = now + args.ttlMinutes * 60_000;
    const actorName = userDisplayName(user);
    const simulationId = `sim_${now}_${randomToken(6)}`;

    const simulation = {
      id: simulationId,
      messageText,
      address,
      ...(coordinates !== undefined ? { coordinates } : {}),
      playAudio,
      startedAt: now,
      expiresAt,
      startedBy: user._id,
      startedByName: actorName,
    };

    const existing = await ctx.db
      .query("turnoutControl")
      .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
      .unique();
    const revision = (existing?.revision ?? 0) + 1;

    if (existing) {
      await ctx.db.patch("turnoutControl", existing._id, {
        revision,
        activeSimulation: simulation,
        updatedAt: now,
        updatedBy: user._id,
        updatedByName: actorName,
      });
    } else {
      await ctx.db.insert("turnoutControl", {
        siteId,
        revision,
        overrides: {},
        activeSimulation: simulation,
        updatedAt: now,
        updatedBy: user._id,
        updatedByName: actorName,
      });
    }

    await ctx.db.insert("turnoutControlAudit", {
      siteId,
      action: "startSimulation",
      actorId: user._id,
      actorName,
      summary: `Started ${args.ttlMinutes}m training simulation at ${address} (audio: ${playAudio ? "on" : "off"})`,
      revision,
      createdAt: now,
    });

    await ctx.scheduler.runAt(expiresAt, internal.turnoutControl.expireSimulationIfDue, {
      siteId,
      simulationId,
    });

    return { revision, simulationId, expiresAt };
  },
});

/** Immediately end any active training simulation on the turnout screen. */
export const stopSimulation = mutation({
  args: {
    siteId: v.optional(v.string()),
  },
  returns: v.object({
    revision: v.number(),
    wasActive: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireModule(
      ctx,
      MODULE_ID,
      "Only authorised Turnout Control administrators can end a training simulation",
    );

    const siteId = resolveSiteId(args.siteId);
    const existing = await ctx.db
      .query("turnoutControl")
      .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
      .unique();

    if (!existing || !existing.activeSimulation) {
      return { revision: existing?.revision ?? 0, wasActive: false };
    }

    const now = Date.now();
    const actorName = userDisplayName(user);
    const endedAddress = existing.activeSimulation.address;
    const revision = existing.revision + 1;

    await ctx.db.patch("turnoutControl", existing._id, {
      revision,
      activeSimulation: undefined,
      updatedAt: now,
      updatedBy: user._id,
      updatedByName: actorName,
    });

    await ctx.db.insert("turnoutControlAudit", {
      siteId,
      action: "stopSimulation",
      actorId: user._id,
      actorName,
      summary: `Ended training simulation at ${endedAddress}`,
      revision,
      createdAt: now,
    });

    return { revision, wasActive: true };
  },
});

/** Scheduled auto-expiry handler; clears the simulation only if its ID is still active. */
export const expireSimulationIfDue = internalMutation({
  args: {
    siteId: v.string(),
    simulationId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { siteId, simulationId }) => {
    const existing = await ctx.db
      .query("turnoutControl")
      .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
      .unique();

    if (!existing?.activeSimulation || existing.activeSimulation.id !== simulationId) {
      return false;
    }

    const now = Date.now();
    const expiredAddress = existing.activeSimulation.address;
    const revision = existing.revision + 1;
    const actorName = "System (TTL Expiry)";

    await ctx.db.patch("turnoutControl", existing._id, {
      revision,
      activeSimulation: undefined,
      updatedAt: now,
      updatedBy: undefined,
      updatedByName: actorName,
    });

    await ctx.db.insert("turnoutControlAudit", {
      siteId,
      action: "expireSimulation",
      actorId: undefined,
      actorName,
      summary: `Auto-expired training simulation at ${expiredAddress}`,
      revision,
      createdAt: now,
    });

    return true;
  },
});

export { turnoutControlWireValidator };
