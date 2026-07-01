import { internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

/**
 * "Living sandbox" simulator.
 *
 * Periodically nudges member turnout statuses on a NON-production deployment so
 * the availability board looks actively used when really it's just a cron.
 *
 * SAFETY: every function here is gated behind the `SIMULATION_ENABLED` env var.
 * That var is set ONLY on the cloud dev deployment (precious-magpie-647). The
 * cron entry in crons.ts ships to every deployment (including the live VPS via
 * `deploy:convex:vps`), but the handler no-ops anywhere the var isn't "true".
 * Do NOT set SIMULATION_ENABLED on the VPS.
 */

// ── Tunables ────────────────────────────────────────────────────────────────
const CONFIG = {
  // Fraction of eligible members to change each tick (during active hours).
  changeFraction: 0.2,
  // Off-hours: smaller fraction so the board is quieter overnight.
  offHoursFraction: 0.05,
  // Active window in AEST (UTC+10), inclusive start, exclusive end.
  activeHoursAEST: { start: 6, end: 23 },
  // Skip admins so your own account isn't randomized while you watch.
  excludeAdmins: true,
} as const;

type Status = NonNullable<Doc<"users">["currentStatus"]>;

// Weighted pool — higher weight = more likely.
const STATUS_WEIGHTS: Record<Status, number> = {
  "available - station": 30,
  "available - at station": 10,
  "available - satellite": 8,
  "delayed response": 12,
  WFH: 10,
  "WFH - at station": 5,
  "not available": 25,
};

function aestHour(now: number): number {
  return new Date(now + 10 * 60 * 60 * 1000).getUTCHours();
}

function pickWeighted(exclude?: Status): Status {
  const entries = (Object.entries(STATUS_WEIGHTS) as [Status, number][]).filter(
    ([s]) => s !== exclude
  );
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [status, weight] of entries) {
    r -= weight;
    if (r <= 0) return status;
  }
  return entries[entries.length - 1][0];
}

function eligible(users: Doc<"users">[]): Doc<"users">[] {
  return users.filter(
    (u) =>
      !!u.rank && // real member, not a bare auth row
      !u.isAnonymous &&
      (!CONFIG.excludeAdmins || !u.isAdmin)
  );
}

// Fisher–Yates, returns first `count` shuffled.
function sample<T>(arr: T[], count: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, count);
}

async function applyChanges(ctx: MutationCtx, fraction: number): Promise<number> {
  const members = eligible(await ctx.db.query("users").collect());
  if (members.length === 0) return 0;

  const count = Math.max(1, Math.round(members.length * fraction));
  const targets = sample(members, count);
  const now = Date.now();

  for (const member of targets) {
    const status = pickWeighted(member.currentStatus);
    // Mirror updateUserStatus, minus the duration/auto-transition fields.
    await ctx.db.patch(member._id, {
      currentStatus: status,
      statusUpdatedAt: now,
      statusExpiresAt: undefined,
      statusDurationHours: undefined,
      nextStatus: undefined,
      nextStatusAt: undefined,
    });
    await ctx.db.insert("memberStatusHistory", {
      userId: member._id,
      status,
      timestamp: now,
    });
  }
  return targets.length;
}

/**
 * Cron-driven tick. No-ops unless SIMULATION_ENABLED === "true".
 */
export const tick = internalMutation({
  args: {},
  returns: v.object({ changed: v.number(), reason: v.optional(v.string()) }),
  handler: async (ctx) => {
    if (process.env.SIMULATION_ENABLED !== "true") {
      return { changed: 0, reason: "disabled" };
    }
    const hour = aestHour(Date.now());
    const active =
      hour >= CONFIG.activeHoursAEST.start && hour < CONFIG.activeHoursAEST.end;
    const fraction = active ? CONFIG.changeFraction : CONFIG.offHoursFraction;
    const changed = await applyChanges(ctx, fraction);
    return { changed, reason: active ? "active" : "off-hours" };
  },
});

/**
 * Manual one-shot you can run from the dashboard to immediately churn a chosen
 * fraction (defaults to everyone) — handy for seeding a lively initial state.
 * Still env-gated for safety.
 */
export const runOnce = internalMutation({
  args: { fraction: v.optional(v.number()) },
  returns: v.object({ changed: v.number(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    if (process.env.SIMULATION_ENABLED !== "true") {
      return { changed: 0, reason: "disabled" };
    }
    const changed = await applyChanges(ctx, args.fraction ?? 1);
    return { changed };
  },
});
