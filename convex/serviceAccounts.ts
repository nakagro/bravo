import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAdmin, requireAdmin as requireAdminUser } from "./lib/access";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * SHA-256 hash a string and return the hex digest.
 * Works in the Convex V8 runtime (no Node.js required).
 */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a cryptographically random hex token.
 */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Admin helper ───────────────────────────────────────────────────────────

async function requireAdmin(ctx: any): Promise<string> {
  return (await requireAdminUser(ctx, "manage service accounts"))._id;
}

/**
 * PIN sessions are for the kiosk tablets only. Whatever modules an account row
 * lists (older rows may name more), a session is only ever given the kiosk.
 * Every other shared device signs in with a shared account instead.
 */
const KIOSK_ONLY = ["kiosk"];

// ─── Admin Queries ──────────────────────────────────────────────────────────

/**
 * List all service accounts (admin only).
 * Does NOT return PIN hashes.
 */
export const listServiceAccounts = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("serviceAccounts"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      allowedModules: v.array(v.string()),
      lastLoginAt: v.optional(v.number()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    if (!(await getAdmin(ctx))) return [];

    const accounts = await ctx.db.query("serviceAccounts").collect();
    // Strip pinHash from results
    return accounts.map(({ pinHash, ...rest }) => rest);
  },
});

// ─── Admin Mutations ────────────────────────────────────────────────────────

/**
 * Create a new service account with an admin-chosen PIN (6–10 digits).
 */
export const createServiceAccount = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    allowedModules: v.array(v.string()),
    pin: v.string(),
  },
  returns: v.object({
    serviceAccountId: v.id("serviceAccounts"),
    pin: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);

    if (!/^\d{6,10}$/.test(args.pin)) {
      throw new Error("PIN must be 6–10 digits");
    }

    const pin = args.pin;
    const pinHash = await sha256(pin);

    const serviceAccountId = await ctx.db.insert("serviceAccounts", {
      name: args.name.trim(),
      description: args.description?.trim(),
      pinHash,
      isActive: true,
      allowedModules: KIOSK_ONLY,
      createdBy: userId as any,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { serviceAccountId, pin };
  },
});

/**
 * Update a service account's name, description, modules, or active status.
 */
export const updateServiceAccount = mutation({
  args: {
    serviceAccountId: v.id("serviceAccounts"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    allowedModules: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const account = await ctx.db.get(args.serviceAccountId);
    if (!account) {
      throw new Error("Service account not found");
    }

    const updates: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name.trim();
    if (args.description !== undefined)
      updates.description = args.description.trim();
    if (args.allowedModules !== undefined) updates.allowedModules = KIOSK_ONLY;
    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
      // If deactivating, revoke all sessions
      if (!args.isActive) {
        const sessions = await ctx.db
          .query("serviceAccountSessions")
          .withIndex("by_serviceAccountId", (q) =>
            q.eq("serviceAccountId", args.serviceAccountId)
          )
          .collect();
        for (const session of sessions) {
          await ctx.db.delete(session._id);
        }
      }
    }

    await ctx.db.patch(args.serviceAccountId, updates);
    return null;
  },
});

/**
 * Set a new PIN for a service account (admin-chosen, 6–10 digits).
 * Also revokes all existing sessions.
 */
export const regeneratePin = mutation({
  args: {
    serviceAccountId: v.id("serviceAccounts"),
    pin: v.string(),
  },
  returns: v.object({
    pin: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (!/^\d{6,10}$/.test(args.pin)) {
      throw new Error("PIN must be 6–10 digits");
    }

    const account = await ctx.db.get(args.serviceAccountId);
    if (!account) {
      throw new Error("Service account not found");
    }

    const pin = args.pin;
    const pinHash = await sha256(pin);

    await ctx.db.patch(args.serviceAccountId, {
      pinHash,
      updatedAt: Date.now(),
    });

    // Revoke all existing sessions
    const sessions = await ctx.db
      .query("serviceAccountSessions")
      .withIndex("by_serviceAccountId", (q) =>
        q.eq("serviceAccountId", args.serviceAccountId)
      )
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    return { pin };
  },
});

/**
 * Delete a service account and all its sessions.
 */
export const deleteServiceAccount = mutation({
  args: {
    serviceAccountId: v.id("serviceAccounts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const account = await ctx.db.get(args.serviceAccountId);
    if (!account) {
      throw new Error("Service account not found");
    }

    // Delete all sessions
    const sessions = await ctx.db
      .query("serviceAccountSessions")
      .withIndex("by_serviceAccountId", (q) =>
        q.eq("serviceAccountId", args.serviceAccountId)
      )
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Delete the account
    await ctx.db.delete(args.serviceAccountId);
    return null;
  },
});

/**
 * Force logout all sessions for a service account.
 */
export const revokeAllSessions = mutation({
  args: {
    serviceAccountId: v.id("serviceAccounts"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const sessions = await ctx.db
      .query("serviceAccountSessions")
      .withIndex("by_serviceAccountId", (q) =>
        q.eq("serviceAccountId", args.serviceAccountId)
      )
      .collect();

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    return sessions.length;
  },
});

// ─── Rate Limiting ──────────────────────────────────────────────────────────

const MAX_PIN_ATTEMPTS = 5;
// The per-device limit keys on an identifier the client sends, so it only
// slows an honest tablet. This one counts every failure, from anywhere, and
// is what actually stops someone guessing PINs.
const MAX_PIN_ATTEMPTS_GLOBAL = 20;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check whether the given identifier has exceeded the PIN attempt limit.
 */
async function checkRateLimit(
  ctx: any,
  ipIdentifier: string
): Promise<boolean> {
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
  const recentAttempts = await ctx.db
    .query("serviceAccountLoginAttempts")
    .withIndex("by_ipIdentifier_attemptedAt", (q: any) =>
      q.eq("ipIdentifier", ipIdentifier).gte("attemptedAt", windowStart)
    )
    .collect();

  const failedAttempts = recentAttempts.filter((a: any) => !a.success);
  if (failedAttempts.length >= MAX_PIN_ATTEMPTS) return true;

  const allRecent = await ctx.db
    .query("serviceAccountLoginAttempts")
    .withIndex("by_attemptedAt", (q: any) => q.gte("attemptedAt", windowStart))
    .take(500);
  return allRecent.filter((a: any) => !a.success).length >= MAX_PIN_ATTEMPTS_GLOBAL;
}

// ─── Public Auth Functions (no user auth required) ──────────────────────────

/**
 * Validate a PIN and create a session. This is the "login" for service accounts.
 * Returns a session token (stored in localStorage on the client).
 * Rate-limited: 5 failed attempts per 15-minute window.
 */
export const validateServicePin = mutation({
  args: {
    pin: v.string(),
    ipIdentifier: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      token: v.string(),
      accountName: v.string(),
      allowedModules: v.array(v.string()),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const identifier = args.ipIdentifier ?? "unknown";

    // Rate limit check
    const isRateLimited = await checkRateLimit(ctx, identifier);
    if (isRateLimited) {
      return {
        success: false as const,
        error: "Too many failed attempts. Please try again later.",
      };
    }

    const pinHash = await sha256(args.pin);

    // Direct index lookup by pinHash
    const account = await ctx.db
      .query("serviceAccounts")
      .withIndex("by_pinHash", (q: any) => q.eq("pinHash", pinHash))
      .first();

    if (!account || !account.isActive) {
      // Record failed attempt
      await ctx.db.insert("serviceAccountLoginAttempts", {
        ipIdentifier: identifier,
        attemptedAt: Date.now(),
        success: false,
      });
      return { success: false as const, error: "Invalid PIN" };
    }

    // Record successful attempt
    await ctx.db.insert("serviceAccountLoginAttempts", {
      ipIdentifier: identifier,
      attemptedAt: Date.now(),
      success: true,
    });

    // Generate a session token
    const token = generateToken();
    const tokenHash = await sha256(token);

    // Session expires in 30 days
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    // Create the session
    await ctx.db.insert("serviceAccountSessions", {
      serviceAccountId: account._id,
      tokenHash,
      expiresAt,
      createdAt: Date.now(),
    });

    // Update last login time
    await ctx.db.patch(account._id, {
      lastLoginAt: Date.now(),
    });

    return {
      success: true as const,
      token,
      accountName: account.name,
      allowedModules: KIOSK_ONLY,
    };
  },
});

/**
 * Validate an existing session token. Used on app mount to check if a
 * service session is still valid.
 */
export const getServiceSession = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      accountName: v.string(),
      accountDescription: v.optional(v.string()),
      allowedModules: v.array(v.string()),
      serviceAccountId: v.id("serviceAccounts"),
    }),
    v.object({
      valid: v.literal(false),
    })
  ),
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.token);

    const session = await ctx.db
      .query("serviceAccountSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!session) {
      return { valid: false as const };
    }

    // Check expiry
    if (session.expiresAt < Date.now()) {
      return { valid: false as const };
    }

    // Get the service account
    const account = await ctx.db.get(session.serviceAccountId);
    if (!account || !account.isActive) {
      return { valid: false as const };
    }

    return {
      valid: true as const,
      accountName: account.name,
      accountDescription: account.description,
      allowedModules: KIOSK_ONLY,
      serviceAccountId: account._id,
    };
  },
});

/**
 * Logout a service account session by invalidating its token.
 */
export const logoutServiceAccount = mutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tokenHash = await sha256(args.token);

    const session = await ctx.db
      .query("serviceAccountSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }

    return null;
  },
});

// ─── Session Cleanup ────────────────────────────────────────────────────────

/**
 * Clean up expired sessions and old login attempts. Called by cron daily.
 */
export const cleanupExpiredSessions = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let deletedCount = 0;

    // Clean up expired sessions
    const expiredSessions = await ctx.db
      .query("serviceAccountSessions")
      .withIndex("by_expiresAt")
      .collect();

    for (const session of expiredSessions) {
      if (session.expiresAt < now) {
        await ctx.db.delete(session._id);
        deletedCount++;
      }
    }

    // Clean up login attempts older than 24 hours
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oldAttempts = await ctx.db
      .query("serviceAccountLoginAttempts")
      .withIndex("by_attemptedAt")
      .collect();

    for (const attempt of oldAttempts) {
      if (attempt.attemptedAt < oneDayAgo) {
        await ctx.db.delete(attempt._id);
        deletedCount++;
      }
    }

    return deletedCount;
  },
});
