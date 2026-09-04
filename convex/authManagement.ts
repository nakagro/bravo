import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { logAction } from "./lib/logging";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { summarizeLaunches } from "./lib/launches";

/**
 * Search for users by name or email (lightweight query for user list)
 * Returns basic user info for selection
 */
export const searchUsers = query({
  args: {
    searchTerm: v.string(),
  },
  returns: v.array(v.object({
    _id: v.id("users"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const { searchTerm } = args;
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }
    
    const normalizedSearch = searchTerm.toLowerCase().trim();
    const users = await ctx.db.query("users").collect();
    
    // Filter users by name or email
    const matchedUsers = users.filter(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      
      return fullName.includes(normalizedSearch) ||
             name.includes(normalizedSearch) ||
             email.includes(normalizedSearch);
    });
    
    // Return only basic info, limit to 10 results
    return matchedUsers.slice(0, 10).map(user => ({
      _id: user._id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
    }));
  },
});

/**
 * Get comprehensive auth information for a single user
 * This includes user data, auth accounts, sessions, and refresh tokens
 * Admin only query
 */
export const getUserAuthInfo = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.null(),
    v.object({
      user: v.object({
        _id: v.id("users"),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        isAdmin: v.optional(v.boolean()),
        rank: v.optional(v.union(
          v.literal("Brigade Member"),
          v.literal("Probationary"),
          v.literal("Firefighter"),
          v.literal("Lieutenant"),
          v.literal("Captain")
        )),
        currentStatus: v.optional(v.union(
          v.literal("available - station"),
          v.literal("available - at station"),
          v.literal("available - satellite"),
          v.literal("not available"),
          v.literal("delayed response"),
          v.literal("WFH"),
          v.literal("WFH - at station")
        )),
        statusUpdatedAt: v.optional(v.number()),
      }),
      accounts: v.array(v.object({
        _id: v.id("authAccounts"),
        provider: v.optional(v.string()),
        providerAccountId: v.optional(v.string()),
        emailVerified: v.optional(v.string()),
        _creationTime: v.number(),
      })),
      sessions: v.array(v.object({
        _id: v.id("authSessions"),
        _creationTime: v.number(),
      })),
      refreshTokens: v.array(v.object({
        _id: v.id("authRefreshTokens"),
        _creationTime: v.number(),
        expirationTime: v.optional(v.number()),
      })),
      sessionCount: v.number(),
      refreshTokenCount: v.number(),
      lastActivity: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const { userId } = args;
    
    // Get the user
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    
    // Get auth accounts for this user
    const userAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();

    // Get sessions for this user
    const userSessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Get refresh tokens for this user's sessions using the sessionId index
    // This avoids loading all 12k+ tokens into memory
    const userRefreshTokens: Array<{
      _id: any;
      _creationTime: number;
      expirationTime?: number;
    }> = [];
    for (const session of userSessions) {
      const sessionTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      userRefreshTokens.push(...sessionTokens.map((t: any) => ({
        _id: t._id,
        _creationTime: t._creationTime,
        expirationTime: t.expirationTime,
      })));
    }
    
    // Find the most recent activity
    const sessionTimes = userSessions.map(s => s._creationTime);
    const tokenTimes = userRefreshTokens.map(t => t._creationTime);
    const allTimes = [...sessionTimes, ...tokenTimes];
    const lastActivity = allTimes.length > 0 ? Math.max(...allTimes) : undefined;
    
    return {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
        rank: user.rank,
        currentStatus: user.currentStatus,
        statusUpdatedAt: user.statusUpdatedAt,
      },
      accounts: userAccounts.map((account: any) => ({
        _id: account._id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        emailVerified: account.emailVerified,
        _creationTime: account._creationTime,
      })),
      sessions: userSessions.map((session: any) => ({
        _id: session._id,
        _creationTime: session._creationTime,
      })),
      refreshTokens: userRefreshTokens.map((token: any) => ({
        _id: token._id,
        _creationTime: token._creationTime,
        expirationTime: token.expirationTime,
      })),
      sessionCount: userSessions.length,
      refreshTokenCount: userRefreshTokens.length,
      lastActivity,
    };
  },
});

/**
 * Invalidate all sessions for a specific user
 * This will sign them out on all devices
 * Admin only mutation
 */
export const invalidateUserSessions = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    sessionsDeleted: v.number(),
    refreshTokensDeleted: v.number(),
  }),
  handler: async (ctx, args) => {
    // This is a query for now to show what would be deleted
    // The actual deletion would need to be a mutation
    const { userId } = args;
    
    // Get sessions for this user
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Get refresh tokens for these sessions using the sessionId index
    let refreshTokenCount = 0;
    for (const session of sessions) {
      const sessionTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      refreshTokenCount += sessionTokens.length;
    }
    
    return {
      sessionsDeleted: sessions.length,
      refreshTokensDeleted: refreshTokenCount,
    };
  },
});

/**
 * Purge expired refresh tokens for a specific user
 * Admin only mutation
 */
export const purgeExpiredTokens = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    deletedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId } = args;
    const now = Date.now();
    
    // Get the target user for logging
    const targetUser = await ctx.db.get(userId);
    const targetEmail = targetUser?.email || userId;
    
    await logAction(ctx, "purgeExpiredTokens", "Starting purge for user", { targetUser: targetEmail });
    
    // Get sessions for this user
    const userSessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Get refresh tokens for this user's sessions using the sessionId index
    // and find expired ones
    const expiredTokens: Array<{ _id: any }> = [];
    for (const session of userSessions) {
      const sessionTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of sessionTokens) {
        if ((token as any).expirationTime && (token as any).expirationTime < now) {
          expiredTokens.push({ _id: token._id });
        }
      }
    }
    
    // Delete each expired token
    for (const token of expiredTokens) {
      await ctx.db.delete(token._id);
    }
    
    await logAction(ctx, "purgeExpiredTokens", "Completed purge", { 
      targetUser: targetEmail, 
      deletedCount: expiredTokens.length 
    });
    
    return {
      deletedCount: expiredTokens.length,
    };
  },
});

/**
 * Purge all expired refresh tokens across all users
 * Uses batching to avoid Convex read limits
 * Also purges orphaned tokens (tokens with no valid session)
 * Admin only mutation
 */
export const purgeAllExpiredTokens = mutation({
  args: {},
  returns: v.object({
    message: v.string(),
    status: v.string(),
  }),
  handler: async (ctx) => {
    await logAction(ctx, "purgeAllExpiredTokens", "Initiating batched purge of expired and orphaned tokens");
    
    // Schedule the expired tokens purge
    await ctx.scheduler.runAfter(0, internal.authManagement.purgeExpiredTokensBatch, {
      cursor: null,
      totalDeleted: 0,
      batchNumber: 1,
    });
    
    // Also schedule orphaned tokens purge (runs in parallel)
    await ctx.scheduler.runAfter(0, internal.authManagement.purgeOrphanedTokensBatch, {
      cursor: null,
      totalDeleted: 0,
      batchNumber: 1,
    });
    
    return {
      message: "Purge started. Processing expired tokens AND orphaned tokens (tokens with deleted sessions) in batches.",
      status: "started",
    };
  },
});

/**
 * Internal mutation to process expired tokens in batches
 * Processes up to BATCH_SIZE sessions per invocation, then schedules itself for more
 */
export const purgeExpiredTokensBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    totalDeleted: v.number(),
    batchNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const BATCH_SIZE = 50; // Process 50 sessions per batch to stay well under limits
    const now = Date.now();

    // Cursor-based pagination over sessions (Convex built-in)
    const result = await ctx.db
      .query("authSessions")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor });
    const sessions = result.page;

    let deletedInBatch = 0;
    
    for (const session of sessions) {
      const sessionTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      
      for (const token of sessionTokens) {
        if ((token as any).expirationTime && (token as any).expirationTime < now) {
          await ctx.db.delete(token._id);
          deletedInBatch++;
        }
      }
    }
    
    const newTotal = args.totalDeleted + deletedInBatch;
    console.log(`[INFO] [purgeExpiredTokensBatch] Batch ${args.batchNumber}: Processed ${sessions.length} sessions, deleted ${deletedInBatch} tokens (total: ${newTotal})`);

    // If there are more pages, schedule the next batch with the opaque cursor
    if (!result.isDone) {
      await ctx.scheduler.runAfter(100, internal.authManagement.purgeExpiredTokensBatch, {
        cursor: result.continueCursor,
        totalDeleted: newTotal,
        batchNumber: args.batchNumber + 1,
      });
    } else {
      console.log(`[INFO] [purgeExpiredTokensBatch] All batches complete. Total expired tokens deleted: ${newTotal}`);
    }

    return null;
  },
});

/**
 * Internal mutation to purge orphaned tokens (tokens with no valid session)
 * This handles tokens that were left behind when sessions were deleted
 */
export const purgeOrphanedTokensBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    totalDeleted: v.number(),
    batchNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const BATCH_SIZE = 200; // Can process more since we're just checking existence

    // Get a page of refresh tokens (Convex built-in cursor pagination - never
    // loads all ~12k tokens at once)
    const result = await ctx.db
      .query("authRefreshTokens")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor });
    const tokens = result.page;

    let deletedInBatch = 0;
    
    for (const token of tokens) {
      const sessionId = (token as any).sessionId;
      if (sessionId) {
        // Check if the session exists
        const session = await ctx.db.get(sessionId);
        if (!session) {
          // Orphaned token - session doesn't exist
          await ctx.db.delete(token._id);
          deletedInBatch++;
        }
      } else {
        // Token has no sessionId - delete it
        await ctx.db.delete(token._id);
        deletedInBatch++;
      }
    }
    
    const newTotal = args.totalDeleted + deletedInBatch;
    console.log(`[INFO] [purgeOrphanedTokensBatch] Batch ${args.batchNumber}: Checked ${tokens.length} tokens, deleted ${deletedInBatch} orphaned (total: ${newTotal})`);

    if (!result.isDone) {
      await ctx.scheduler.runAfter(100, internal.authManagement.purgeOrphanedTokensBatch, {
        cursor: result.continueCursor,
        totalDeleted: newTotal,
        batchNumber: args.batchNumber + 1,
      });
    } else {
      console.log(`[INFO] [purgeOrphanedTokensBatch] All batches complete. Total orphaned tokens deleted: ${newTotal}`);
    }

    return null;
  },
});

/**
 * Internal mutation to purge expired sessions in batches
 * Sessions past their expirationTime are no longer valid and can be removed
 * Also cleans up all refresh tokens belonging to expired sessions
 */
export const purgeExpiredSessionsBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    totalSessionsDeleted: v.number(),
    totalTokensDeleted: v.number(),
    batchNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const BATCH_SIZE = 50;
    const now = Date.now();

    const result = await ctx.db
      .query("authSessions")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor });
    const sessions = result.page;

    let sessionsDeleted = 0;
    let tokensDeleted = 0;

    for (const session of sessions) {
      if ((session as any).expirationTime && (session as any).expirationTime < now) {
        // Delete all refresh tokens for this expired session first
        const sessionTokens = await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
          .collect();
        for (const token of sessionTokens) {
          await ctx.db.delete(token._id);
          tokensDeleted++;
        }
        // Then delete the session itself
        await ctx.db.delete(session._id);
        sessionsDeleted++;
      }
    }

    const newSessionsTotal = args.totalSessionsDeleted + sessionsDeleted;
    const newTokensTotal = args.totalTokensDeleted + tokensDeleted;
    console.log(
      `[INFO] [purgeExpiredSessionsBatch] Batch ${args.batchNumber}: Checked ${sessions.length} sessions, deleted ${sessionsDeleted} expired sessions + ${tokensDeleted} tokens (totals: ${newSessionsTotal} sessions, ${newTokensTotal} tokens)`
    );

    if (!result.isDone) {
      await ctx.scheduler.runAfter(100, internal.authManagement.purgeExpiredSessionsBatch, {
        cursor: result.continueCursor,
        totalSessionsDeleted: newSessionsTotal,
        totalTokensDeleted: newTokensTotal,
        batchNumber: args.batchNumber + 1,
      });
    } else {
      console.log(
        `[INFO] [purgeExpiredSessionsBatch] All batches complete. Sessions deleted: ${newSessionsTotal}, tokens deleted: ${newTokensTotal}`
      );
    }

    return null;
  },
});

/**
 * Scheduled daily auth cleanup
 * Runs all three cleanup operations: expired sessions, expired tokens, and orphaned tokens
 * Designed to be called from a cron job
 */
export const scheduledAuthCleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("[INFO] [scheduledAuthCleanup] Starting daily auth cleanup");

    // 1. Purge expired sessions (and their tokens)
    await ctx.scheduler.runAfter(0, internal.authManagement.purgeExpiredSessionsBatch, {
      cursor: null,
      totalSessionsDeleted: 0,
      totalTokensDeleted: 0,
      batchNumber: 1,
    });

    // 2. Purge expired tokens (from still-valid sessions)
    await ctx.scheduler.runAfter(500, internal.authManagement.purgeExpiredTokensBatch, {
      cursor: null,
      totalDeleted: 0,
      batchNumber: 1,
    });

    // 3. Purge orphaned tokens (sessions deleted but tokens left behind)
    await ctx.scheduler.runAfter(1000, internal.authManagement.purgeOrphanedTokensBatch, {
      cursor: null,
      totalDeleted: 0,
      batchNumber: 1,
    });

    return null;
  },
});

/**
 * Get auth summary statistics
 * Uses sampling to avoid read limits on large datasets
 */
export const getAuthStats = query({
  args: {},
  returns: v.object({
    totalUsers: v.number(),
    totalSessions: v.number(),
    totalRefreshTokens: v.number(),
    usersWithMultipleSessions: v.number(),
    expiredTokenCount: v.number(),
    orphanedTokenCount: v.number(),
  }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const sessions = await ctx.db.query("authSessions").collect();
    const sessionIds = new Set(sessions.map(s => s._id));
    
    // Count sessions per user
    const sessionsPerUser = new Map<string, number>();
    for (const session of sessions) {
      const userId = (session as any).userId;
      if (userId) {
        sessionsPerUser.set(userId, (sessionsPerUser.get(userId) || 0) + 1);
      }
    }
    
    const usersWithMultipleSessions = Array.from(sessionsPerUser.values())
      .filter(count => count > 1).length;
    
    // Sample tokens directly to count expired and orphaned
    // Take a limited sample to avoid read limits
    const SAMPLE_SIZE = 2000;
    const tokenSample = await ctx.db.query("authRefreshTokens").take(SAMPLE_SIZE);
    
    const now = Date.now();
    let expiredCount = 0;
    let orphanedCount = 0;
    
    for (const token of tokenSample) {
      const sessionId = (token as any).sessionId;
      const isOrphaned = !sessionId || !sessionIds.has(sessionId);
      const isExpired = (token as any).expirationTime && (token as any).expirationTime < now;
      
      if (isOrphaned) {
        orphanedCount++;
      } else if (isExpired) {
        expiredCount++;
      }
    }
    
    // Estimate total based on sample if we hit the limit
    // This gives a rough idea without hitting read limits
    const totalRefreshTokens = tokenSample.length;
    const isEstimate = tokenSample.length === SAMPLE_SIZE;
    
    return {
      totalUsers: users.length,
      totalSessions: sessions.length,
      totalRefreshTokens: isEstimate ? totalRefreshTokens : tokenSample.length,
      usersWithMultipleSessions,
      expiredTokenCount: expiredCount,
      orphanedTokenCount: orphanedCount,
    };
  },
});

/**
 * "When was each member last on BRAVO?" for the whole roster.
 *
 * There is no explicit last-seen field on `users`, but the auth tables already
 * record it as a side effect: a session row is created at sign-in, and the
 * client mints a fresh refresh token every time it exchanges its access token
 * while the app is open. The newest of those timestamps is the last time the
 * app was demonstrably running for that person.
 *
 * That makes this retroactive - it works for activity that happened long before
 * this query existed - at the cost of granularity: it answers "had the app open
 * around then", not "tapped a button at 09:41". Someone who signed out shows as
 * never seen, because signing out deletes the evidence.
 */
export const getMemberActivity = query({
  args: {},
  returns: v.array(v.object({
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    rank: v.optional(v.string()),
    isAdmin: v.boolean(),
    isShared: v.boolean(),
    isDisabled: v.boolean(),
    /** Newest session or refresh-token timestamp; absent means no live session. */
    lastSeenAt: v.optional(v.number()),
    /** When they first signed in on a session that is still alive. */
    firstSessionAt: v.optional(v.number()),
    /** Live sessions, i.e. roughly how many devices they're signed in on. */
    deviceCount: v.number(),
    /** Their last availability change - activity that outlives a sign-out. */
    statusUpdatedAt: v.optional(v.number()),
    /**
     * Last availability change from `memberStatusHistory`. Unlike
     * `statusUpdatedAt`, the nightly reset doesn't wipe it, so it's the honest
     * answer to "when did this member last tell us anything".
     */
    lastStatusChangeAt: v.optional(v.number()),
    /**
     * How they open BRAVO on a phone, from `userLaunches` over the last 30 days.
     * "browser-only" is the member who keeps ignoring the install prompt and is
     * not getting notifications; "none" is no phone launch recorded.
     */
    phoneInstall: v.union(
      v.literal("installed"),
      v.literal("browser-only"),
      v.literal("none"),
    ),
    lastInstalledLaunchAt: v.optional(v.number()),
    lastBrowserLaunchAt: v.optional(v.number()),
  })),
  handler: async (ctx) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("You must be signed in");
    const actor = await ctx.db.get(actorId);
    if (!actor || !actor.isAdmin) {
      throw new Error("Only administrators can view member activity");
    }

    const now = Date.now();
    const users = await ctx.db.query("users").collect();
    const sessions = await ctx.db.query("authSessions").collect();

    // Newest refresh token per session. Reading only the first row of the
    // sessionId index keeps this cheap on a table with thousands of tokens.
    const latestTokenBySession = new Map<string, number>();
    for (const session of sessions) {
      const newest = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .order("desc")
        .first();
      if (newest) latestTokenBySession.set(session._id, newest._creationTime);
    }

    const activityByUser = new Map<
      string,
      { lastSeenAt: number; firstSessionAt: number; deviceCount: number }
    >();
    for (const session of sessions) {
      const seen = Math.max(
        session._creationTime,
        latestTokenBySession.get(session._id) ?? 0,
      );
      const existing = activityByUser.get(session.userId);
      if (existing) {
        existing.lastSeenAt = Math.max(existing.lastSeenAt, seen);
        existing.firstSessionAt = Math.min(existing.firstSessionAt, session._creationTime);
        existing.deviceCount += 1;
      } else {
        activityByUser.set(session.userId, {
          lastSeenAt: seen,
          firstSessionAt: session._creationTime,
          deviceCount: 1,
        });
      }
    }

    const people = users.filter(
      // Bare auth rows with no name aren't people anyone can act on.
      (user) => !user.isAnonymous && (user.firstName || user.lastName || user.name),
    );

    return await Promise.all(
      people.map(async (user) => {
        const activity = activityByUser.get(user._id);
        const lastStatusChange = await ctx.db
          .query("memberStatusHistory")
          .withIndex("by_user_and_timestamp", (q) => q.eq("userId", user._id))
          .order("desc")
          .first();
        const launches = await ctx.db
          .query("userLaunches")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        const launchSummary = summarizeLaunches(launches, now);
        const name = user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.name || user.email || "Unknown user";
        return {
          userId: user._id,
          name,
          email: user.email,
          rank: user.rank,
          isAdmin: user.isAdmin === true,
          isShared: user.accountType === "shared",
          isDisabled: user.isDisabled === true,
          lastSeenAt: activity?.lastSeenAt,
          firstSessionAt: activity?.firstSessionAt,
          deviceCount: activity?.deviceCount ?? 0,
          statusUpdatedAt: user.statusUpdatedAt,
          lastStatusChangeAt: lastStatusChange?.timestamp,
          ...launchSummary,
        };
      }),
    );
  },
});

/**
 * The sessions behind one member's "last seen", newest first.
 *
 * These are live sessions only - roughly "devices currently signed in" - because
 * signing out or expiring deletes the row. So this is a short history of how
 * they're using the app, not a permanent sign-in log.
 */
export const getUserSessionHistory = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    sessionId: v.id("authSessions"),
    startedAt: v.number(),
    /** Newest refresh in this session, i.e. last confirmed use of the app. */
    lastSeenAt: v.number(),
    /** How many times the app refreshed its token on this session. */
    refreshCount: v.number(),
    expiresAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("You must be signed in");
    const actor = await ctx.db.get(actorId);
    if (!actor || !actor.isAdmin) {
      throw new Error("Only administrators can view member activity");
    }

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    const rows = [];
    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      const newest = tokens.reduce(
        (max, token) => Math.max(max, token._creationTime),
        session._creationTime,
      );
      rows.push({
        sessionId: session._id,
        startedAt: session._creationTime,
        lastSeenAt: newest,
        refreshCount: tokens.length,
        expiresAt: session.expirationTime,
      });
    }

    return rows
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, args.limit ?? 10);
  },
});

/**
 * One member's recent availability changes, newest first.
 *
 * `memberStatusHistory` records every deliberate set - in-app, iOS Shortcut, or
 * an automatic timed transition - but nothing is written when a status is
 * cleared by the 04:00 reset or by expiry, so the trail shows what they set and
 * when, not when it lapsed.
 */
export const getUserStatusHistory = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("memberStatusHistory"),
    status: v.string(),
    timestamp: v.number(),
  })),
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("You must be signed in");
    const actor = await ctx.db.get(actorId);
    if (!actor || !actor.isAdmin) {
      throw new Error("Only administrators can view member activity");
    }

    const entries = await ctx.db
      .query("memberStatusHistory")
      .withIndex("by_user_and_timestamp", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 10);

    return entries.map((entry) => ({
      _id: entry._id,
      status: entry.status,
      timestamp: entry.timestamp,
    }));
  },
});
