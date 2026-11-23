import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireModuleAccess } from "./modules";
import { isMemberAccount } from "./lib/accountType";
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

const SITE_ORDER: Record<string, number> = {
  main: 0,
  satellite: 1,
};

async function requireAccessControlMember(ctx: QueryCtx | MutationCtx) {
  const userId = await requireModuleAccess(
    ctx,
    "accessControl",
    "Access Control requires Lieutenant rank or above",
  );
  const user = await ctx.db.get(userId);
  if (!user || !isMemberAccount(user)) {
    throw new Error("Access Control requires an active member account");
  }
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const actorName = fullName || user.name || user.email || "Member";
  return { userId, actorName };
}

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
    panel: "inception" | "challenger";
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
        areas: v.array(accessAreaValidator),
        doors: v.array(accessDoorValidator),
      }),
    ),
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
    await requireAccessControlMember(ctx);

    const rawSites = await ctx.db.query("accessSites").collect();
    const sites = rawSites
      .sort((a, b) => (SITE_ORDER[a.siteId] ?? 99) - (SITE_ORDER[b.siteId] ?? 99))
      .map((s) => ({
        id: s.siteId,
        name: s.name,
        panel: s.panel,
        panelLabel: s.panelLabel,
        writesEnabled: s.writesEnabled,
        bridgeVersion: s.bridgeVersion,
        lastSeenAt: s.lastSeenAt,
        areas: s.areas,
        doors: s.doors,
      }));

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

    return { sites, events, recentCommands };
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
      if (!area.canControl) throw new Error(`${area.name} is view-only`);
      targetName = area.name;
    } else if (args.targetKind === "door") {
      if (args.action !== "pulse" && args.action !== "unlock" && args.action !== "lock") {
        throw new Error(`Action "${args.action}" is not valid for a door`);
      }
      const door = site.doors.find((d) => d.id === args.targetId && d.kind === "door");
      if (!door) throw new Error("Door not found on this site");
      if (!door.canControl) throw new Error(`${door.name} is view-only`);
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
      if (!roller.canControl) throw new Error(`${roller.name} is view-only`);
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

    const pending = await ctx.db
      .query("accessCommands")
      .withIndex("by_site_status", (q) =>
        q.eq("siteId", siteId).eq("status", "pending"),
      )
      .order("asc")
      .collect();

    for (const cmd of pending) {
      if (now > cmd.expiresAt) {
        const message = "Expired before bridge could claim command";
        await ctx.db.patch(cmd._id, {
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
        continue;
      }

      await ctx.db.patch(cmd._id, {
        status: "executing",
        claimedAt: now,
      });

      return {
        serverTime: now,
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

    return { serverTime: now, command: null };
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
