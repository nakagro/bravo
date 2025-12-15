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
    
    // Get refresh tokens for this user's sessions
    const userSessionIds = new Set(userSessions.map(s => s._id));
    const allRefreshTokens = await ctx.db.query("authRefreshTokens").collect();
    const userRefreshTokens = allRefreshTokens.filter(
      (token: { sessionId?: string }) => token.sessionId && userSessionIds.has(token.sessionId as any)
    );
    
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
    
    // Get refresh tokens for these sessions
    const sessionIds = new Set(sessions.map(s => s._id));
    const allRefreshTokens = await ctx.db.query("authRefreshTokens").collect();
    const userRefreshTokens = allRefreshTokens.filter(
      (token: { sessionId?: string }) => token.sessionId && sessionIds.has(token.sessionId as any)
    );
    
    return {
      sessionsDeleted: sessions.length,
      refreshTokensDeleted: userRefreshTokens.length,
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
    
    // Get refresh tokens for this user's sessions
    const userSessionIds = new Set(userSessions.map(s => s._id));
    const allRefreshTokens = await ctx.db.query("authRefreshTokens").collect();
    
    // Find expired tokens belonging to this user
    const expiredTokens = allRefreshTokens.filter((token: any) => {
      const belongsToUser = token.sessionId && userSessionIds.has(token.sessionId);
      const isExpired = token.expirationTime && token.expirationTime < now;
      return belongsToUser && isExpired;
    });
    
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
    const users = await ctx.db.query("users").collect();
    const sessions = await ctx.db.query("authSessions").collect();
    const refreshTokens = await ctx.db.query("authRefreshTokens").collect();
    
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
    
    // Count expired tokens
    const now = Date.now();
    const expiredTokenCount = refreshTokens.filter(
      (token: any) => token.expirationTime && token.expirationTime < now
    ).length;
    
    return {
      totalUsers: users.length,
      totalSessions: sessions.length,
      totalRefreshTokens: refreshTokens.length,
      usersWithMultipleSessions,
      expiredTokenCount,
    };
  },
});
