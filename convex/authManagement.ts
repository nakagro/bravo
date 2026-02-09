import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { logAction } from "./lib/logging";
import { internal } from "./_generated/api";

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
          v.literal("Probationary"),
          v.literal("Firefighter"),
          v.literal("Lieutenant"),
          v.literal("Captain")
        )),
        currentStatus: v.optional(v.union(
          v.literal("available - station"),
          v.literal("available - satellite"),
          v.literal("not available"),
          v.literal("delayed response"),
          v.literal("WFH")
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
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    
    // Get sessions for this user
    const userSessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), userId))
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
      .filter((q) => q.eq(q.field("userId"), userId))
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
      .filter((q) => q.eq(q.field("userId"), userId))
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
    
    // Query sessions with cursor-based pagination
    let sessionsQuery = ctx.db.query("authSessions");
    
    // If we have a cursor, filter to sessions after that ID
    if (args.cursor) {
      sessionsQuery = sessionsQuery.filter((q) => 
        q.gt(q.field("_id"), args.cursor as string)
      );
    }
    
    const sessions = await sessionsQuery.take(BATCH_SIZE);
    
    if (sessions.length === 0) {
      // No more sessions to process
      console.log(`[INFO] [purgeExpiredTokensBatch] All batches complete. Total expired tokens deleted: ${args.totalDeleted}`);
      return null;
    }
    
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
    
    // Get the last session ID to use as cursor for next batch
    const lastSession = sessions[sessions.length - 1];
    
    // If we got a full batch, there might be more
    if (sessions.length === BATCH_SIZE) {
      // Schedule next batch with small delay
      await ctx.scheduler.runAfter(100, internal.authManagement.purgeExpiredTokensBatch, {
        cursor: lastSession._id,
        totalDeleted: newTotal,
        batchNumber: args.batchNumber + 1,
      });
    } else {
      // Got less than BATCH_SIZE, we're done
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
    
    // Get a batch of refresh tokens
    let tokensQuery = ctx.db.query("authRefreshTokens");
    
    if (args.cursor) {
      tokensQuery = tokensQuery.filter((q) => 
        q.gt(q.field("_id"), args.cursor as string)
      );
    }
    
    const tokens = await tokensQuery.take(BATCH_SIZE);
    
    if (tokens.length === 0) {
      console.log(`[INFO] [purgeOrphanedTokensBatch] All batches complete. Total orphaned tokens deleted: ${args.totalDeleted}`);
      return null;
    }
    
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
    
    const lastToken = tokens[tokens.length - 1];
    
    if (tokens.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(100, internal.authManagement.purgeOrphanedTokensBatch, {
        cursor: lastToken._id,
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

    let sessionsQuery = ctx.db.query("authSessions");
    if (args.cursor) {
      sessionsQuery = sessionsQuery.filter((q) =>
        q.gt(q.field("_id"), args.cursor as string)
      );
    }

    const sessions = await sessionsQuery.take(BATCH_SIZE);

    if (sessions.length === 0) {
      console.log(
        `[INFO] [purgeExpiredSessionsBatch] All batches complete. Sessions deleted: ${args.totalSessionsDeleted}, tokens deleted: ${args.totalTokensDeleted}`
      );
      return null;
    }

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

    const lastSession = sessions[sessions.length - 1];

    if (sessions.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(100, internal.authManagement.purgeExpiredSessionsBatch, {
        cursor: lastSession._id,
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
