import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireModuleAccess } from "./modules";
import { isMemberAccount } from "./lib/accountType";
import { isAdminUser, isSuperAdmin, requireUser } from "./lib/access";
import {
  ACCESS_COMMAND_TTL_MS,
  ACCESS_COOLDOWN_MS,
  ACCESS_EXECUTING_TIMEOUT_MS,
  ACCESS_MAX_EVENTS_PER_SITE,
  ACCESS_RECENT_COMMANDS_WINDOW_MS,
  ACCESS_STALE_AFTER_MS,
  accessAreaValidator,
  accessDoorValidator,
  accessEventInputValidator,
  accessEventSourceValidator,
  accessSitePayloadValidator,
  commandActionValidator,
  commandCompletionStatusValidator,
  commandStatusValidator,
  commandTargetKindValidator,
  panelKindValidator,
} from "./lib/accessControlValidators";
import {
  accessActorName,
  accessWritesState,
  writesDisabledMessage,
} from "./lib/accessControlWrites";

const SITE_ORDER: Record<string, number> = {
  main: 0,
  satellite: 1,
};

const dashboardAreaValidator = accessAreaValidator.extend({
  bridgeCanControl: v.boolean(),
  controlOverride: v.optional(v.boolean()),
});

const dashboardDoorValidator = accessDoorValidator.extend({
  bridgeCanControl: v.boolean(),
  controlOverride: v.optional(v.boolean()),
});

function readOverride(
  overrides: Record<string, boolean> | undefined,
  targetId: string,
): boolean | undefined {
  if (!overrides || !Object.prototype.hasOwnProperty.call(overrides, targetId)) {
    return undefined;
  }
  return overrides[targetId];
}

function effectiveCanControl(
  bridgeCanControl: boolean,
  overrides: Record<string, boolean> | undefined,
  targetId: string,
): boolean {
  const override = readOverride(overrides, targetId);
  return override !== undefined ? override : bridgeCanControl;
}

async function isAccessControlSuperAdminOnly(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const setting = await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", "accessControl"))
    .first();
  return setting?.superAdminOnly === true;
}

async function canUserManageAccessControls(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
): Promise<boolean> {
  if (isSuperAdmin(user)) return true;
  if (!isAdminUser(user)) return false;
  return !(await isAccessControlSuperAdminOnly(ctx));
}

async function requireAccessControlManager(ctx: MutationCtx, action: string): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (isSuperAdmin(user)) return user;
  const superOnly = await isAccessControlSuperAdminOnly(ctx);
  if (superOnly) {
    throw new ConvexError(`Only super administrators can ${action}`);
  }
  if (!isAdminUser(user)) {
    throw new ConvexError(`Only administrators can ${action}`);
  }
  return user;
}

async function requireAccessControlMember(ctx: QueryCtx | MutationCtx) {
  const superOnly = await isAccessControlSuperAdminOnly(ctx);
  const userId = await requireModuleAccess(
    ctx,
    "accessControl",
    superOnly
      ? "Access Control is restricted to super administrators"
      : "Access Control requires Lieutenant rank or above",
  );
  const user = await ctx.db.get("users", userId);
  if (!user || !isMemberAccount(user)) {
    throw new Error("Access Control requires an active member account");
  }
  return { userId, user, actorName: actorNameFor(user) };
}

/** The name sent to the site bridges and shown in activity. Never an email. */
function actorNameFor(user: Doc<"users">): string {
  return accessActorName(user);
}

/** Mark one unclaimed command expired, with its audit entry. */
async function expireCommand(ctx: MutationCtx, cmd: Doc<"accessCommands">, now: number) {
  const message = "Expired before bridge could claim command";
  await ctx.db.patch("accessCommands", cmd._id, {
    status: "expired",
    completedAt: now,
    message,
  });
  await ctx.db.insert("accessAuditLog", {
    commandId: cmd._id,
    siteId: cmd.siteId,
    targetKind: cmd.targetKind,
    targetId: cmd.targetId,
    action: cmd.action,
    requestedBy: cmd.requestedBy,
    actorName: cmd.actorName,
    status: "expired",
    message,
    createdAt: cmd.createdAt,
    completedAt: now,
  });
}

/** BRAVO's own switch for a site's remote controls. No row means off. */
async function siteControlsFor(ctx: QueryCtx | MutationCtx, siteId: string) {
  return await ctx.db
    .query("accessSiteControls")
    .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
    .unique();
}

/** Fail every unclaimed command for a site (or one target), e.g. when its controls are turned off. */
async function failPendingCommands(
  ctx: MutationCtx,
  siteId: string,
  message: string,
  now: number,
  targetFilter?: { targetKind?: "area" | "door" | "roller"; targetId: string },
) {
  const pending = await ctx.db
    .query("accessCommands")
    .withIndex("by_site_status", (q) => q.eq("siteId", siteId).eq("status", "pending"))
    .take(100);
  for (const cmd of pending) {
    if (targetFilter) {
      if (cmd.targetId !== targetFilter.targetId) continue;
      if (targetFilter.targetKind && cmd.targetKind !== targetFilter.targetKind) continue;
    }
    await ctx.db.patch("accessCommands", cmd._id, {
      status: "failed",
      completedAt: now,
      message,
    });
    await ctx.db.insert("accessAuditLog", {
      commandId: cmd._id,
      siteId: cmd.siteId,
      targetKind: cmd.targetKind,
      targetId: cmd.targetId,
      action: cmd.action,
      requestedBy: cmd.requestedBy,
      actorName: cmd.actorName,
      status: "failed",
      message,
      createdAt: cmd.createdAt,
      completedAt: now,
    });
  }
}

const CONTROLS_OFF_MESSAGE = "Remote controls are turned off for this station";
const TARGET_OFF_MESSAGE = "Remote control is turned off for this item";

function actionLabel(action: string, targetName: string): string {
  switch (action) {
    case "arm":
      return `${targetName} armed`;
    case "arm_stay":
      return `${targetName} armed (stay)`;
    case "disarm":
      return `${targetName} disarmed`;
    case "pulse":
      return `${targetName} unlocked`;
    case "unlock":
      return `${targetName} kept unlocked`;
    case "lock":
      return `${targetName} locked`;
    case "open_roller":
      return `${targetName} opened`;
    case "disarm_and_open_roller":
      return `Disarmed and opened ${targetName}`;
    default:
      return `${targetName}: ${action}`;
  }
}

async function applySiteSnapshot(
  ctx: MutationCtx,
  siteId: string,
  site: {
    name: string;
    panel: string;
    panelLabel: string;
    writesEnabled: boolean;
    bridgeVersion?: string;
    areas: Array<{
      id: string;
      name: string;
      status: "armed" | "disarmed" | "alarm" | "exitDelay" | "entryDelay";
      changedAt: number;
      changedBy?: string;
      canControl: boolean;
    }>;
    doors: Array<{
      id: string;
      name: string;
      kind: "door" | "roller";
      status: "secured" | "unlocked" | "open" | "heldOpen" | "forced" | "offline";
      changedAt: number;
      canControl: boolean;
      supportsHold: boolean;
      unlockedUntil?: number;
    }>;
  },
  events:
    | Array<{
        externalId: string;
        at: number;
        text: string;
        who?: string;
      }>
    | undefined,
  now: number,
) {
  const existing = await ctx.db
    .query("accessSites")
    .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
    .unique();

  const patch = {
    siteId,
    name: site.name,
    panel: site.panel,
    panelLabel: site.panelLabel,
    writesEnabled: site.writesEnabled,
    bridgeVersion: site.bridgeVersion,
    lastSeenAt: now,
    areas: site.areas,
    doors: site.doors,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("accessSites", patch);
  }

  if (events && events.length > 0) {
    for (const ev of events.slice(0, ACCESS_MAX_EVENTS_PER_SITE)) {
      const dup = await ctx.db
        .query("accessEvents")
        .withIndex("by_site_externalId", (q) =>
          q.eq("siteId", siteId).eq("externalId", ev.externalId),
        )
        .unique();
      if (!dup) {
        await ctx.db.insert("accessEvents", {
          siteId,
          externalId: ev.externalId,
          at: ev.at,
          text: ev.text,
          who: ev.who,
          source: "panel",
        });
      }
    }
  }

  // Keep event history bounded per site.
  const allSiteEvents = await ctx.db
    .query("accessEvents")
    .withIndex("by_site_at", (q) => q.eq("siteId", siteId))
    .order("desc")
    .collect();
  for (const staleEvent of allSiteEvents.slice(ACCESS_MAX_EVENTS_PER_SITE)) {
    await ctx.db.delete(staleEvent._id);
  }
}

export const getDashboard = query({
  args: {},
  returns: v.object({
    sites: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        panel: panelKindValidator,
        panelLabel: v.string(),
        writesEnabled: v.boolean(),
        bridgeVersion: v.optional(v.string()),
        lastSeenAt: v.number(),
        areas: v.array(dashboardAreaValidator),
        doors: v.array(dashboardDoorValidator),
        controlsEnabled: v.boolean(),
        controlsChangedBy: v.optional(v.string()),
        controlsChangedAt: v.optional(v.number()),
        bravoWritesDisabled: v.boolean(),
        bravoWritesDisabledReason: v.optional(
          v.union(v.literal("allSites"), v.literal("thisSite")),
        ),
      }),
    ),
    canManageControls: v.boolean(),
    events: v.array(
      v.object({
        id: v.id("accessEvents"),
        siteId: v.string(),
        at: v.number(),
        text: v.string(),
        who: v.optional(v.string()),
        source: accessEventSourceValidator,
      }),
    ),
    recentCommands: v.array(
      v.object({
        id: v.id("accessCommands"),
        siteId: v.string(),
        targetKind: commandTargetKindValidator,
        targetId: v.string(),
        action: commandActionValidator,
        status: commandStatusValidator,
        actorName: v.string(),
        createdAt: v.number(),
        expiresAt: v.number(),
        completedAt: v.optional(v.number()),
        message: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const { user } = await requireAccessControlMember(ctx);

    const rawSites = await ctx.db.query("accessSites").take(10);
    rawSites.sort((a, b) => (SITE_ORDER[a.siteId] ?? 99) - (SITE_ORDER[b.siteId] ?? 99));
    const sites = await Promise.all(
      rawSites.map(async (s) => {
        const controls = await siteControlsFor(ctx, s.siteId);
        const writes = accessWritesState(s.siteId);
        return {
          id: s.siteId,
          name: s.name,
          panel: s.panel,
          panelLabel: s.panelLabel,
          writesEnabled: s.writesEnabled,
          bridgeVersion: s.bridgeVersion,
          lastSeenAt: s.lastSeenAt,
          areas: s.areas.map((a) => {
            const controlOverride = readOverride(controls?.areaControls, a.id);
            return {
              ...a,
              bridgeCanControl: a.canControl,
              canControl: effectiveCanControl(a.canControl, controls?.areaControls, a.id),
              ...(controlOverride !== undefined ? { controlOverride } : {}),
            };
          }),
          doors: s.doors.map((d) => {
            const controlOverride = readOverride(controls?.doorControls, d.id);
            return {
              ...d,
              bridgeCanControl: d.canControl,
              canControl: effectiveCanControl(d.canControl, controls?.doorControls, d.id),
              ...(controlOverride !== undefined ? { controlOverride } : {}),
            };
          }),
          controlsEnabled: controls?.controlsEnabled ?? false,
          controlsChangedBy: controls?.changedByName,
          controlsChangedAt: controls?.changedAt,
          bravoWritesDisabled: writes.disabled,
          bravoWritesDisabledReason: writes.disabled ? writes.reason : undefined,
        };
      }),
    );

    const eventsBySite = await Promise.all(
      sites.map((s) =>
        ctx.db
          .query("accessEvents")
          .withIndex("by_site_at", (q) => q.eq("siteId", s.id))
          .order("desc")
          .take(15),
      ),
    );
    const events = eventsBySite
      .flat()
      .sort((a, b) => b.at - a.at)
      .map((e) => ({
        id: e._id,
        siteId: e.siteId,
        at: e.at,
        text: e.text,
        who: e.who,
        source: e.source,
      }));

    const cutoff = Date.now() - ACCESS_RECENT_COMMANDS_WINDOW_MS;
    const rawCommands = await ctx.db
      .query("accessCommands")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", cutoff))
      .order("desc")
      .take(25);

    const recentCommands = rawCommands.map((c) => ({
      id: c._id,
      siteId: c.siteId,
      targetKind: c.targetKind,
      targetId: c.targetId,
      action: c.action,
      status: c.status,
      actorName: c.actorName,
      createdAt: c.createdAt,
      expiresAt: c.expiresAt,
      completedAt: c.completedAt,
      message: c.message,
    }));

    const canManageControls = await canUserManageAccessControls(ctx, user);
    return { sites, canManageControls, events, recentCommands };
  },
});

export const requestCommand = mutation({
  args: {
    siteId: v.string(),
    targetKind: commandTargetKindValidator,
    targetId: v.string(),
    action: commandActionValidator,
    pulseMs: v.optional(v.number()),
  },
  returns: v.object({
    commandId: v.id("accessCommands"),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId, actorName } = await requireAccessControlMember(ctx);
    const now = Date.now();

    const site = await ctx.db
      .query("accessSites")
      .withIndex("by_siteId", (q) => q.eq("siteId", args.siteId))
      .unique();
    if (!site) {
      throw new Error("Site has not reported in yet");
    }

    // The server-side kill switch beats everything, admins included. The
    // refusal is recorded as a failed command rather than thrown, because a
    // throw would roll back the audit entry. The page shows its message.
    if (accessWritesState(args.siteId).disabled) {
      const message = writesDisabledMessage(site.name);
      const target =
        args.targetKind === "area"
          ? site.areas.find((a) => a.id === args.targetId)
          : site.doors.find((d) => d.id === args.targetId);
      const commandId = await ctx.db.insert("accessCommands", {
        siteId: args.siteId,
        targetKind: args.targetKind,
        targetId: args.targetId,
        targetName: target?.name ?? args.targetId,
        action: args.action,
        pulseMs: args.pulseMs,
        status: "failed",
        requestedBy: userId,
        actorName,
        createdAt: now,
        expiresAt: now,
        completedAt: now,
        message,
      });
      await ctx.db.insert("accessAuditLog", {
        commandId,
        siteId: args.siteId,
        targetKind: args.targetKind,
        targetId: args.targetId,
        action: args.action,
        requestedBy: userId,
        actorName,
        status: "refused",
        message,
        createdAt: now,
        completedAt: now,
      });
      return { commandId, expiresAt: now };
    }

    const controls = await siteControlsFor(ctx, args.siteId);
    if (!controls?.controlsEnabled) {
      throw new ConvexError(`Remote controls are turned off for ${site.name}`);
    }
    if (now - site.lastSeenAt > ACCESS_STALE_AFTER_MS) {
      throw new Error(`${site.name} is offline. Controls are blocked until it reconnects.`);
    }
    if (!site.writesEnabled) {
      throw new Error(`${site.name} bridge is currently in read-only mode`);
    }

    if (args.pulseMs !== undefined) {
      if (!Number.isInteger(args.pulseMs) || args.pulseMs < 100 || args.pulseMs > 5000) {
        throw new Error("pulseMs must be an integer between 100 and 5000");
      }
    }

    let targetName = args.targetId;

    if (args.targetKind === "area") {
      if (args.action !== "arm" && args.action !== "arm_stay" && args.action !== "disarm") {
        throw new Error(`Action "${args.action}" is not valid for an area`);
      }
      const area = site.areas.find((a) => a.id === args.targetId);
      if (!area) throw new Error("Area not found on this site");
      if (!effectiveCanControl(area.canControl, controls.areaControls, area.id)) {
        throw new Error(`${area.name} is view-only`);
      }
      targetName = area.name;
    } else if (args.targetKind === "door") {
      if (args.action !== "pulse" && args.action !== "unlock" && args.action !== "lock") {
        throw new Error(`Action "${args.action}" is not valid for a door`);
      }
      const door = site.doors.find((d) => d.id === args.targetId && d.kind === "door");
      if (!door) throw new Error("Door not found on this site");
      if (!effectiveCanControl(door.canControl, controls.doorControls, door.id)) {
        throw new Error(`${door.name} is view-only`);
      }
      if ((args.action === "unlock" || args.action === "lock") && !door.supportsHold) {
        throw new Error(`${door.name} does not support hold unlock/lock`);
      }
      targetName = door.name;
    } else {
      if (args.action !== "open_roller" && args.action !== "disarm_and_open_roller") {
        throw new Error(`Action "${args.action}" is not valid for a roller door`);
      }
      const roller = site.doors.find((d) => d.id === args.targetId && d.kind === "roller");
      if (!roller) throw new Error("Roller door not found on this site");
      if (!effectiveCanControl(roller.canControl, controls.doorControls, roller.id)) {
        throw new Error(`${roller.name} is view-only`);
      }
      if (roller.status === "open" || roller.status === "heldOpen") {
        throw new Error(
          `${roller.name} is already open. Remote close is disabled without line of sight.`,
        );
      }
      const anyArmed = site.areas.some((a) => a.status === "armed");
      if (args.action === "open_roller" && anyArmed) {
        throw new Error(
          `${site.name} alarm is armed. Use Disarm and Open or disarm the area first.`,
        );
      }
      targetName = roller.name;
    }

    // Cooldown / duplicate in-flight guard.
    const recentForSite = await ctx.db
      .query("accessCommands")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", now - ACCESS_COOLDOWN_MS))
      .order("desc")
      .take(20);
    const duplicate = recentForSite.find(
      (c) =>
        c.siteId === args.siteId &&
        c.targetId === args.targetId &&
        (c.status === "pending" || c.status === "executing"),
    );
    if (duplicate) {
      throw new Error(`A command for ${targetName} is already in progress`);
    }

    const expiresAt = now + ACCESS_COMMAND_TTL_MS;
    const commandId = await ctx.db.insert("accessCommands", {
      siteId: args.siteId,
      targetKind: args.targetKind,
      targetId: args.targetId,
      targetName,
      action: args.action,
      pulseMs: args.pulseMs,
      status: "pending",
      requestedBy: userId,
      actorName,
      createdAt: now,
      expiresAt,
    });

    await ctx.db.insert("accessAuditLog", {
      commandId,
      siteId: args.siteId,
      targetKind: args.targetKind,
      targetId: args.targetId,
      action: args.action,
      requestedBy: userId,
      actorName,
      status: "queued",
      createdAt: now,
    });

    return { commandId, expiresAt };
  },
});

/**
 * BRAVO's off switch for one site's remote controls. Managers only (super
 * admins while Access Control is super-admin-only, admins otherwise). Turning
 * it off fails anything still queued; a command the bridge already claimed is
 * left to report its own result.
 */
export const setSiteControls = mutation({
  args: {
    siteId: v.string(),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { siteId, enabled }) => {
    const admin = await requireAccessControlManager(ctx, "turn remote controls on or off");
    const site = await ctx.db
      .query("accessSites")
      .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
      .unique();
    if (!site) throw new ConvexError("Site has not reported in yet");

    const now = Date.now();
    const changedByName = actorNameFor(admin);
    const existing = await siteControlsFor(ctx, siteId);
    if (existing?.controlsEnabled === enabled) return null;

    if (existing) {
      await ctx.db.patch("accessSiteControls", existing._id, {
        controlsEnabled: enabled,
        changedBy: admin._id,
        changedByName,
        changedAt: now,
      });
    } else {
      await ctx.db.insert("accessSiteControls", {
        siteId,
        controlsEnabled: enabled,
        changedBy: admin._id,
        changedByName,
        changedAt: now,
      });
    }

    if (!enabled) {
      await failPendingCommands(ctx, siteId, CONTROLS_OFF_MESSAGE, now);
    }

    await ctx.db.insert("accessEvents", {
      siteId,
      externalId: `bravo:controls:${now}`,
      at: now,
      text: enabled ? "Remote controls turned on" : "Remote controls turned off",
      who: changedByName,
      source: "bravo",
    });
    return null;
  },
});

/**
 * Per-door / per-area BRAVO control switch. Overrides the bridge's `canControl`
 * flag in either direction (turn a view-only door on, or turn a controllable
 * door off) without editing external bridge config. Passing `enabled: null`
 * clears the override back to the bridge default.
 */
export const setTargetControl = mutation({
  args: {
    siteId: v.string(),
    targetKind: v.union(v.literal("area"), v.literal("door")),
    targetId: v.string(),
    enabled: v.union(v.boolean(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { siteId, targetKind, targetId, enabled }) => {
    const manager = await requireAccessControlManager(ctx, "configure remote controls");
    const site = await ctx.db
      .query("accessSites")
      .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
      .unique();
    if (!site) throw new ConvexError("Site has not reported in yet");

    const target =
      targetKind === "area"
        ? site.areas.find((a) => a.id === targetId)
        : site.doors.find((d) => d.id === targetId);
    if (!target) {
      throw new ConvexError(targetKind === "area" ? "Area not found on this site" : "Door not found on this site");
    }

    const now = Date.now();
    const changedByName = actorNameFor(manager);
    const existing = await siteControlsFor(ctx, siteId);
    const currentMap =
      targetKind === "area" ? { ...(existing?.areaControls ?? {}) } : { ...(existing?.doorControls ?? {}) };

    if (enabled === null) {
      if (!Object.prototype.hasOwnProperty.call(currentMap, targetId)) return null;
      delete currentMap[targetId];
    } else {
      if (currentMap[targetId] === enabled) return null;
      currentMap[targetId] = enabled;
    }

    const fieldPatch =
      targetKind === "area" ? { areaControls: currentMap } : { doorControls: currentMap };

    if (existing) {
      await ctx.db.patch("accessSiteControls", existing._id, {
        ...fieldPatch,
        changedBy: manager._id,
        changedByName,
        changedAt: now,
      });
    } else {
      await ctx.db.insert("accessSiteControls", {
        siteId,
        controlsEnabled: false,
        ...fieldPatch,
        changedBy: manager._id,
        changedByName,
        changedAt: now,
      });
    }

    const nowControllable = effectiveCanControl(target.canControl, currentMap, targetId);
    if (!nowControllable) {
      await failPendingCommands(ctx, siteId, TARGET_OFF_MESSAGE, now, { targetId });
    }

    const text =
      enabled === null
        ? `${target.name} control reset to bridge default`
        : enabled
          ? `${target.name} control turned on`
          : `${target.name} control turned off`;

    await ctx.db.insert("accessEvents", {
      siteId,
      externalId: `bravo:target:${targetKind}:${targetId}:${now}`,
      at: now,
      text,
      who: changedByName,
      source: "bravo",
    });
    return null;
  },
});

/** Clear every per-area and per-door override for one site back to bridge defaults. */
export const resetSiteTargetControls = mutation({
  args: {
    siteId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { siteId }) => {
    const manager = await requireAccessControlManager(ctx, "configure remote controls");
    const site = await ctx.db
      .query("accessSites")
      .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
      .unique();
    if (!site) throw new ConvexError("Site has not reported in yet");

    const existing = await siteControlsFor(ctx, siteId);
    if (!existing) return null;
    const hasOverrides =
      Object.keys(existing.areaControls ?? {}).length > 0 ||
      Object.keys(existing.doorControls ?? {}).length > 0;
    if (!hasOverrides) return null;

    const now = Date.now();
    const changedByName = actorNameFor(manager);

    await ctx.db.patch("accessSiteControls", existing._id, {
      areaControls: {},
      doorControls: {},
      changedBy: manager._id,
      changedByName,
      changedAt: now,
    });

    // Fail any pending commands for targets that are view-only by bridge default.
    for (const a of site.areas) {
      if (!a.canControl) {
        await failPendingCommands(ctx, siteId, TARGET_OFF_MESSAGE, now, { targetId: a.id });
      }
    }
    for (const d of site.doors) {
      if (!d.canControl) {
        await failPendingCommands(ctx, siteId, TARGET_OFF_MESSAGE, now, { targetId: d.id });
      }
    }

    await ctx.db.insert("accessEvents", {
      siteId,
      externalId: `bravo:target:reset:${now}`,
      at: now,
      text: "Door and area controls reset to bridge defaults",
      who: changedByName,
      source: "bravo",
    });
    return null;
  },
});

export const ingestSiteState = internalMutation({
  args: {
    siteId: v.string(),
    site: accessSitePayloadValidator,
    events: v.optional(v.array(accessEventInputValidator)),
  },
  returns: v.object({
    ok: v.boolean(),
    serverTime: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    await applySiteSnapshot(ctx, args.siteId, args.site, args.events, now);
    return { ok: true, serverTime: now };
  },
});

export const claimNextCommand = internalMutation({
  args: {
    siteId: v.string(),
  },
  returns: v.object({
    serverTime: v.number(),
    /** True while the server-side kill switch blocks this site. Additive: older bridges ignore it. */
    writesDisabled: v.boolean(),
    command: v.union(
      v.null(),
      v.object({
        commandId: v.id("accessCommands"),
        siteId: v.string(),
        targetKind: commandTargetKindValidator,
        targetId: v.string(),
        action: commandActionValidator,
        pulseMs: v.optional(v.number()),
        actorName: v.string(),
        createdAt: v.number(),
        expiresAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx, { siteId }) => {
    const now = Date.now();

    // Fail any wedged executing commands so a crashed bridge does not block the queue.
    const executing = await ctx.db
      .query("accessCommands")
      .withIndex("by_site_status", (q) =>
        q.eq("siteId", siteId).eq("status", "executing"),
      )
      .collect();
    for (const cmd of executing) {
      if (now - (cmd.claimedAt ?? cmd.createdAt) > ACCESS_EXECUTING_TIMEOUT_MS) {
        const message = "Timed out waiting for bridge confirmation";
        await ctx.db.patch(cmd._id, {
          status: "failed",
          completedAt: now,
          message,
        });
        await ctx.db.insert("accessAuditLog", {
          commandId: cmd._id,
          siteId: cmd.siteId,
          targetKind: cmd.targetKind,
          targetId: cmd.targetId,
          action: cmd.action,
          requestedBy: cmd.requestedBy,
          actorName: cmd.actorName,
          status: "failed",
          message,
          createdAt: cmd.createdAt,
          completedAt: now,
        });
      }
    }

    // Server-side kill switch: hand out nothing, and fail everything queued for
    // this site straight away (as the BRAVO controls-off path below does), so
    // nothing queued before the switch went on can run after it is lifted.
    if (accessWritesState(siteId).disabled) {
      const site = await ctx.db
        .query("accessSites")
        .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
        .unique();
      await failPendingCommands(ctx, siteId, writesDisabledMessage(site?.name ?? siteId), now);
      return { serverTime: now, writesDisabled: true, command: null };
    }

    // Belt and braces: never hand the bridge a command while BRAVO has the
    // site's controls off, even one queued just before they were turned off.
    const siteControls = await siteControlsFor(ctx, siteId);
    if (!siteControls?.controlsEnabled) {
      await failPendingCommands(ctx, siteId, CONTROLS_OFF_MESSAGE, now);
      return { serverTime: now, writesDisabled: false, command: null };
    }

    const site = await ctx.db
      .query("accessSites")
      .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
      .unique();

    const pending = await ctx.db
      .query("accessCommands")
      .withIndex("by_site_status", (q) =>
        q.eq("siteId", siteId).eq("status", "pending"),
      )
      .order("asc")
      .collect();

    for (const cmd of pending) {
      if (now > cmd.expiresAt) {
        await expireCommand(ctx, cmd, now);
        continue;
      }

      // Also refuse if this specific area/door was turned off in BRAVO after queuing.
      const targetAllowed = (() => {
        if (!site) return true;
        if (cmd.targetKind === "area") {
          const area = site.areas.find((a) => a.id === cmd.targetId);
          return area ? effectiveCanControl(area.canControl, siteControls.areaControls, area.id) : false;
        }
        const door = site.doors.find((d) => d.id === cmd.targetId);
        return door ? effectiveCanControl(door.canControl, siteControls.doorControls, door.id) : false;
      })();

      if (!targetAllowed) {
        await ctx.db.patch(cmd._id, {
          status: "failed",
          completedAt: now,
          message: TARGET_OFF_MESSAGE,
        });
        await ctx.db.insert("accessAuditLog", {
          commandId: cmd._id,
          siteId: cmd.siteId,
          targetKind: cmd.targetKind,
          targetId: cmd.targetId,
          action: cmd.action,
          requestedBy: cmd.requestedBy,
          actorName: cmd.actorName,
          status: "failed",
          message: TARGET_OFF_MESSAGE,
          createdAt: cmd.createdAt,
          completedAt: now,
        });
        continue;
      }

      await ctx.db.patch(cmd._id, {
        status: "executing",
        claimedAt: now,
      });

      return {
        serverTime: now,
        writesDisabled: false,
        command: {
          commandId: cmd._id,
          siteId: cmd.siteId,
          targetKind: cmd.targetKind,
          targetId: cmd.targetId,
          action: cmd.action,
          pulseMs: cmd.pulseMs,
          actorName: cmd.actorName,
          createdAt: cmd.createdAt,
          expiresAt: cmd.expiresAt,
        },
      };
    }

    return { serverTime: now, writesDisabled: false, command: null };
  },
});

export const completeCommand = internalMutation({
  args: {
    siteId: v.string(),
    commandId: v.string(),
    status: commandCompletionStatusValidator,
    message: v.optional(v.string()),
    site: v.optional(accessSitePayloadValidator),
    events: v.optional(v.array(accessEventInputValidator)),
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = ctx.db.normalizeId("accessCommands", args.commandId) as Id<"accessCommands"> | null;
    if (!id) {
      return { ok: false, error: "Invalid commandId" };
    }
    const cmd = await ctx.db.get(id);
    if (!cmd || cmd.siteId !== args.siteId) {
      return { ok: false, error: "Command not found for site" };
    }
    if (cmd.status !== "executing" && cmd.status !== "pending") {
      return { ok: false, error: `Command already terminal (${cmd.status})` };
    }

    await ctx.db.patch(cmd._id, {
      status: args.status,
      completedAt: now,
      message: args.message,
    });

    await ctx.db.insert("accessAuditLog", {
      commandId: cmd._id,
      siteId: cmd.siteId,
      targetKind: cmd.targetKind,
      targetId: cmd.targetId,
      action: cmd.action,
      requestedBy: cmd.requestedBy,
      actorName: cmd.actorName,
      status: args.status,
      message: args.message,
      createdAt: cmd.createdAt,
      completedAt: now,
    });

    if (args.status === "succeeded") {
      await ctx.db.insert("accessEvents", {
        siteId: cmd.siteId,
        externalId: `bravo:${cmd._id}`,
        at: now,
        text: actionLabel(cmd.action, cmd.targetName),
        who: cmd.actorName,
        source: "bravo",
      });
    }

    if (args.site) {
      await applySiteSnapshot(ctx, args.siteId, args.site, args.events, now);
    }

    return { ok: true };
  },
});
