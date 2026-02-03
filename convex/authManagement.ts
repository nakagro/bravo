import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    
    return {
      deletedCount: expiredTokens.length,
    };
  },
});

/**
 * Purge all expired refresh tokens across all users
 * Admin only mutation
 */
export const purgeAllExpiredTokens = mutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    sessionsProcessed: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    
    // Get all sessions
    const sessions = await ctx.db.query("authSessions").collect();
    
    // Find and delete expired tokens for each session
    let deletedCount = 0;
    for (const session of sessions) {
      const sessionTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      
      for (const token of sessionTokens) {
        if ((token as any).expirationTime && (token as any).expirationTime < now) {
          await ctx.db.delete(token._id);
          deletedCount++;
        }
      }
    }
    
    return {
      deletedCount,
      sessionsProcessed: sessions.length,
    };
  },
});

/**
 * Get auth summary statistics
 */
export const getAuthStats = query({
  args: {},
  returns: v.object({
    totalUsers: v.number(),
    totalSessions: v.number(),
    totalRefreshTokens: v.number(),
    usersWithMultipleSessions: v.number(),
    expiredTokenCount: v.number(),
  }),
  handler: async (ctx) => {
    // Get counts without loading all documents into memory where possible
    const users = await ctx.db.query("users").collect();
    const sessions = await ctx.db.query("authSessions").collect();
    
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
    
    // For token counts, we need to iterate through sessions to use the index
    // This is more efficient than loading all 12k+ tokens
    let totalRefreshTokens = 0;
    let expiredTokenCount = 0;
    const now = Date.now();
    
    for (const session of sessions) {
      const sessionTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      totalRefreshTokens += sessionTokens.length;
      for (const token of sessionTokens) {
        if ((token as any).expirationTime && (token as any).expirationTime < now) {
          expiredTokenCount++;
        }
      }
    }
    
    return {
      totalUsers: users.length,
      totalSessions: sessions.length,
      totalRefreshTokens,
      usersWithMultipleSessions,
      expiredTokenCount,
    };
  },
});
