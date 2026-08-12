import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { accountTypeValidator, isMemberAccount } from "./lib/accountType";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * Shared gate for the account-lifecycle mutations below: only a signed-in admin
 * may run them, and never against their own account (an admin locking themselves
 * out of the only admin screen is unrecoverable from inside the app).
 */
async function requireAdminActingOnSomeoneElse(
  ctx: MutationCtx,
  targetUserId: Id<"users">,
  verb: string,
) {
  const actorId = await getAuthUserId(ctx);
  if (!actorId) throw new Error("You must be signed in");

  const actor = await ctx.db.get(actorId);
  if (!actor || !actor.isAdmin) {
    throw new Error(`Only administrators can ${verb} accounts`);
  }
  if (actorId === targetUserId) {
    throw new Error(`You cannot ${verb} your own account`);
  }

  const target = await ctx.db.get(targetUserId);
  if (!target) throw new Error(`User with ID ${targetUserId} not found`);

  return { actorId, target };
}

/**
 * Drop every live session for a user, so an account that was just disabled or
 * deleted stops working on devices that are already signed in rather than at
 * the next login. Refresh tokens hang off sessions and must go with them.
 */
async function revokeSessions(ctx: MutationCtx, userId: Id<"users">) {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  for (const session of sessions) {
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of refreshTokens) {
      await ctx.db.delete(token._id);
    }
    await ctx.db.delete(session._id);
  }
}

/**
 * One-off backfill: assign the floor rank "Brigade Member" to any user that
 * currently has no rank (legacy null/undefined), so the removed "no rank"
 * state no longer exists. Safe to run repeatedly (idempotent).
 * Run via: npx convex run users:backfillBrigadeMemberRank (or the dashboard).
 */
export const backfillBrigadeMemberRank = internalMutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updated = 0;
    for (const user of users) {
      if (!user.rank) {
        await ctx.db.patch(user._id, { rank: "Brigade Member" });
        updated++;
      }
    }
    return { updated };
  },
});

/**
 * Get all users from the system
 */
export const getUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

/**
 * Members only - for pickers that are choosing a person, not an account.
 *
 * Deliberately separate from `getUsers`, which must keep returning shared
 * accounts so the admin User Management screen can see and edit them.
 */
export const getMemberUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.filter(isMemberAccount);
  },
});

/**
 * Get all admin users from the system
 */
export const getAdminUsers = query({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    return allUsers.filter(user => user.isAdmin === true);
  },
});

/**
 * Get a user by ID
 */
export const getUserById = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get all roles from the system
 */
export const getRoles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("roles").collect();
  },
});

/**
 * Mark a login as a member or a shared (non-person) account.
 *
 * Unlike the neighbouring `updateUserRank`/`updateUserRoles`, this checks
 * `isAdmin` server-side (following `convex/serviceAccounts.ts`) - a new mutation
 * shouldn't inherit an existing gap. Rank is deliberately left alone: module
 * access is gated on it, so clearing it would lock the account out of modules
 * with a `minimumRank`.
 */
export const updateUserAccountType = mutation({
  args: {
    userId: v.id("users"),
    accountType: accountTypeValidator,
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) {
      throw new Error("You must be signed in");
    }
    const actor = await ctx.db.get(actorId);
    if (!actor || !actor.isAdmin) {
      throw new Error("Only administrators can change an account type");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error(`User with ID ${args.userId} not found`);
    }

    await ctx.db.patch(args.userId, { accountType: args.accountType });
    return args.userId;
  },
});

/**
 * Update a user's rank
 */
export const updateUserRank = mutation({
  args: {
    userId: v.id("users"),
    rank: v.union(
      v.literal("Brigade Member"),
      v.literal("Probationary"),
      v.literal("Firefighter"),
      v.literal("Lieutenant"),
      v.literal("Captain")
    ),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const { userId, rank } = args;
    
    // Verify the user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Update the user's rank
    await ctx.db.patch(userId, { rank });
    
    return userId;
  },
});

/**
 * Update a user's roles
 */
export const updateUserRoles = mutation({
  args: {
    userId: v.id("users"),
    roles: v.array(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const { userId, roles } = args;
    
    // Verify the user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Update the user's roles
    await ctx.db.patch(userId, { roles });
    
    return userId;
  },
});

/**
 * Update a user's admin status
 */
export const updateUserAdminStatus = mutation({
  args: {
    userId: v.id("users"),
    isAdmin: v.boolean(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const { userId, isAdmin } = args;
    
    // Verify the user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Update the user's admin status
    await ctx.db.patch(userId, { isAdmin });
    
    return userId;
  },
});

/**
 * Create a new role
 */
export const createRole = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("roles"),
  handler: async (ctx, args) => {
    const { name, description } = args;
    
    // Check if role with the same name already exists
    const existingRole = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
      
    if (existingRole) {
      throw new Error(`Role with name "${name}" already exists`);
    }
    
    const roleId = await ctx.db.insert("roles", {
      name,
      description,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return roleId;
  },
});

/**
 * Update an existing role
 * If the name is changed, cascades the update to moduleSettings and users
 */
export const updateRole = mutation({
  args: {
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.id("roles"),
  handler: async (ctx, args) => {
    const { roleId, name, description, isActive } = args;
    
    // Verify the role exists
    const role = await ctx.db.get(roleId);
    if (!role) {
      throw new Error(`Role with ID ${roleId} not found`);
    }
    
    const oldName = role.name;
    const newName = name?.trim();
    
    // If renaming, check for duplicate and cascade the change
    if (newName && newName !== oldName) {
      // Check if another role with the new name already exists
      const existingRole = await ctx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", newName))
        .first();
      
      if (existingRole && existingRole._id !== roleId) {
        throw new Error(`Role with name "${newName}" already exists`);
      }
      
      // Cascade rename to moduleSettings.requiredRoles
      const moduleSettings = await ctx.db.query("moduleSettings").collect();
      for (const moduleSetting of moduleSettings) {
        if (moduleSetting.requiredRoles?.includes(oldName)) {
          const updatedRoles = moduleSetting.requiredRoles.map(r => 
            r === oldName ? newName : r
          );
          await ctx.db.patch(moduleSetting._id, { requiredRoles: updatedRoles });
        }
      }
      
      // Cascade rename to users.roles
      const users = await ctx.db.query("users").collect();
      for (const user of users) {
        if (user.roles?.includes(oldName)) {
          const updatedRoles = user.roles.map(r => 
            r === oldName ? newName : r
          );
          await ctx.db.patch(user._id, { roles: updatedRoles });
        }
      }
    }
    
    // Build update object
    const updateObj: { name?: string; description?: string; isActive?: boolean; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (newName) updateObj.name = newName;
    if (description !== undefined) updateObj.description = description;
    if (isActive !== undefined) updateObj.isActive = isActive;
    
    // Update the role
    await ctx.db.patch(roleId, updateObj);
    
    return roleId;
  },
});

/**
 * Delete a role
 */
export const deleteRole = mutation({
  args: {
    roleId: v.id("roles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { roleId } = args;
    
    // Verify the role exists
    const role = await ctx.db.get(roleId);
    if (!role) {
      throw new Error(`Role with ID ${roleId} not found`);
    }
    
    // Delete the role
    await ctx.db.delete(roleId);
    
    return null;
  },
});

/**
 * Disable or re-enable an account.
 *
 * This is the intended way to retire someone who has left the brigade: the
 * `users` row stays, so every record that points at them (station checks, BA
 * records, kit history, event responses) still resolves to a name, but they
 * lose their login and drop out of every member-facing list via
 * `isMemberAccount`. Reversible - re-enabling restores them with their rank,
 * roles and password intact.
 */
export const setUserDisabled = mutation({
  args: {
    userId: v.id("users"),
    isDisabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { actorId, target } = await requireAdminActingOnSomeoneElse(
      ctx,
      args.userId,
      args.isDisabled ? "disable" : "enable",
    );

    if (args.isDisabled) {
      await ctx.db.patch(args.userId, {
        isDisabled: true,
        disabledAt: Date.now(),
        disabledBy: actorId,
        // A departed member can't be left holding the standing Duty Officer flag.
        ...(target.isDutyOfficer ? { isDutyOfficer: false } : {}),
      });

      // Sign them out everywhere, and stop their phone getting brigade pushes.
      await revokeSessions(ctx, args.userId);
      const subscriptions = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      for (const subscription of subscriptions) {
        await ctx.db.delete(subscription._id);
      }
    } else {
      await ctx.db.patch(args.userId, {
        isDisabled: false,
        disabledAt: undefined,
        disabledBy: undefined,
      });
    }

    return null;
  },
});

/**
 * Permanently delete a user and their auth accounts, freeing the email address
 * for reuse.
 *
 * Deliberately narrow: it removes the login and the person's row, not the
 * brigade records they touched. Those keep a now-dangling `v.id("users")` and
 * will render as an unknown user - which is why `setUserDisabled` is the right
 * tool for anyone with history, and this one is for mistaken or duplicate
 * signups.
 */
export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = args;

    await requireAdminActingOnSomeoneElse(ctx, userId, "delete");

    // Find and delete all auth accounts associated with this user
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();

    for (const account of authAccounts) {
      // Outstanding verification codes point at the account, not the user.
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) {
        await ctx.db.delete(code._id);
      }
      await ctx.db.delete(account._id);
    }

    await revokeSessions(ctx, userId);

    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const subscription of subscriptions) {
      await ctx.db.delete(subscription._id);
    }

    // Delete the user
    await ctx.db.delete(userId);

    return null;
  },
});
