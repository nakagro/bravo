import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import {
  assertCanManageTargetUser,
  getActiveUser,
  getAdmin,
  isSuperAdmin,
  requireAdmin as requireAdminUser,
  requireSuperAdmin,
  revokeSessions,
} from "./lib/access";
import { ConvexError, v } from "convex/values";
import { accountTypeValidator, isMemberAccount } from "./lib/accountType";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { deletePlannedShiftsForUser } from "./plannedShifts";
import { isValidLieutenantNumber } from "./lib/ranks";

/**
 * Shared gate for the account-lifecycle mutations below: only a signed-in admin
 * may run them, and never against their own account (an admin locking themselves
 * out of the only admin screen is unrecoverable from inside the app). Regular
 * admins cannot disable, delete, or otherwise modify a super admin account.
 */
async function requireAdminActingOnSomeoneElse(
  ctx: MutationCtx,
  targetUserId: Id<"users">,
  verb: string,
) {
  const actor = await requireAdminUser(ctx, `${verb} accounts`);
  const actorId = actor._id;
  if (actorId === targetUserId) {
    throw new Error(`You cannot ${verb} your own account`);
  }

  const target = await ctx.db.get(targetUserId);
  if (!target) throw new Error(`User with ID ${targetUserId} not found`);

  assertCanManageTargetUser(actor, target);

  return { actorId, target };
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
    // Every account with every field: User Management only.
    if (!(await getAdmin(ctx))) return [];
    return await ctx.db.query("users").collect();
  },
});

/**
 * Members only - for pickers that are choosing a person, not an account.
 *
 * Deliberately separate from `getUsers`, which must keep returning shared
 * accounts so the admin User Management screen can see and edit them.
 */
const memberPickerValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  rank: v.optional(v.string()),
  lieutenantNumber: v.optional(v.number()),
  roles: v.optional(v.array(v.string())),
  skills: v.optional(v.array(v.id("skills"))),
  isDutyOfficer: v.optional(v.boolean()),
});

export const getMemberUsers = query({
  args: {},
  returns: v.array(memberPickerValidator),
  handler: async (ctx) => {
    if (!(await getActiveUser(ctx))) return [];
    const users = await ctx.db.query("users").collect();
    // What a picker needs to show and sort a person - not their email or CFA number.
    return users.filter(isMemberAccount).map((u) => ({
      _id: u._id,
      _creationTime: u._creationTime,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      rank: u.rank,
      lieutenantNumber: u.lieutenantNumber,
      roles: u.roles,
      skills: u.skills,
      isDutyOfficer: u.isDutyOfficer,
    }));
  },
});

/** Every account, for server code (the CAD availability endpoint). */
export const listAllUsers = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("users").collect(),
});

/**
 * Get a user by ID
 */
export const getUserById = internalQuery({
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
    if (!(await getActiveUser(ctx))) return [];
    return await ctx.db.query("roles").collect();
  },
});

/**
 * Mark a login as a member or a shared (non-person) account.
 *
 * Checks `isAdmin` server-side, like its neighbours. Rank is deliberately left alone: module
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
    const actor = await requireAdminUser(ctx, "change an account type");

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error(`User with ID ${args.userId} not found`);
    }

    assertCanManageTargetUser(actor, user, "change account type");

    await ctx.db.patch(args.userId, { accountType: args.accountType });
    return args.userId;
  },
});

/**
 * The signed-in admin, or a throw. Rank, roles and admin status decide what
 * every account can reach, so only an admin may change them.
 */
async function requireAdmin(ctx: MutationCtx, verb: string) {
  return (await requireAdminUser(ctx, verb))._id;
}

/**
 * Update a user's rank, and for a Lieutenant which one (1st to 5th).
 *
 * `lieutenantNumber` is only read when the rank is Lieutenant: a number, null
 * to clear it, or omitted to leave it alone. Any other rank clears it. A number
 * already held by someone else moves to this user - that's how a 2nd becomes
 * the 1st - and the previous holder becomes an unnumbered Lieutenant until
 * they're given a new one.
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
    lieutenantNumber: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const actor = await requireAdminUser(ctx, "change a rank");
    const { userId, rank } = args;

    // Verify the user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    assertCanManageTargetUser(actor, user, "change rank");

    let lieutenantNumber = rank === "Lieutenant" ? user.lieutenantNumber : undefined;
    if (rank === "Lieutenant" && args.lieutenantNumber !== undefined) {
      lieutenantNumber = args.lieutenantNumber ?? undefined;
    }

    if (lieutenantNumber !== undefined) {
      if (!isValidLieutenantNumber(lieutenantNumber)) {
        throw new Error("Lieutenant number must be 1st to 5th");
      }
      const holders = await ctx.db
        .query("users")
        .withIndex("by_lieutenantNumber", (q) => q.eq("lieutenantNumber", lieutenantNumber))
        .collect();
      for (const holder of holders) {
        if (holder._id !== userId) {
          assertCanManageTargetUser(actor, holder, "reassign a Lieutenant number");
        }
      }
      for (const holder of holders) {
        if (holder._id !== userId) await ctx.db.patch(holder._id, { lieutenantNumber: undefined });
      }
    }

    await ctx.db.patch(userId, { rank, lieutenantNumber });

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
    const actor = await requireAdminUser(ctx, "change roles");
    const { userId, roles } = args;

    // Verify the user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    assertCanManageTargetUser(actor, user, "change roles");

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
    const actor = await requireAdminUser(ctx, "change admin status");
    const { userId, isAdmin } = args;

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    assertCanManageTargetUser(actor, user, "change admin status");
    if (isSuperAdmin(user) && !isAdmin) {
      throw new ConvexError("Remove super admin status before removing admin status");
    }

    await ctx.db.patch(userId, { isAdmin });

    return userId;
  },
});

/**
 * Update a user's super admin status (super admins only; cannot modify own).
 * Granting super admin also sets `isAdmin: true` so every admin surface works.
 */
export const updateUserSuperAdminStatus = mutation({
  args: {
    userId: v.id("users"),
    isSuperAdmin: v.boolean(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const actor = await requireSuperAdmin(ctx, "change super admin status");
    if (actor._id === args.userId) {
      throw new ConvexError("You cannot change your own super admin status");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error(`User with ID ${args.userId} not found`);
    }

    await ctx.db.patch(args.userId, {
      isSuperAdmin: args.isSuperAdmin,
      ...(args.isSuperAdmin ? { isAdmin: true } : {}),
    });

    return args.userId;
  },
});

/**
 * Internal CLI helper to grant or revoke super admin status (e.g. initial
 * bootstrap: `npx convex run users:setSuperAdmin '{"email":"...","isSuperAdmin":true}'`).
 */
export const setSuperAdmin = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    isSuperAdmin: v.boolean(),
  },
  returns: v.object({
    userId: v.id("users"),
    isSuperAdmin: v.boolean(),
  }),
  handler: async (ctx, args) => {
    let user = args.userId ? await ctx.db.get(args.userId) : null;
    if (!user && args.email) {
      const normalized = args.email.toLowerCase().trim();
      user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", normalized))
        .first();
    }
    if (!user) {
      throw new Error("User not found (provide a valid userId or email)");
    }

    await ctx.db.patch(user._id, {
      isSuperAdmin: args.isSuperAdmin,
      ...(args.isSuperAdmin ? { isAdmin: true } : {}),
    });

    return { userId: user._id, isSuperAdmin: args.isSuperAdmin };
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
    await requireAdmin(ctx, "create roles");
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
    await requireAdmin(ctx, "change roles");
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
    await requireAdmin(ctx, "delete roles");
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

    await deletePlannedShiftsForUser(ctx, userId);

    // Delete the user
    await ctx.db.delete(userId);

    return null;
  },
});

// ─── Sign-up approval ───────────────────────────────────────────────────────

/** Self-service sign-ups waiting for an admin, oldest first. Admins only. */
export const listPendingUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      email: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      name: v.optional(v.string()),
      memberNumber: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    if (!(await getAdmin(ctx))) return [];
    const pending = await ctx.db
      .query("users")
      .withIndex("by_approvalStatus", (q) => q.eq("approvalStatus", "pending"))
      .collect();
    return pending.map((u) => ({
      _id: u._id,
      _creationTime: u._creationTime,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      name: u.name,
      memberNumber: u.memberNumber,
    }));
  },
});

/**
 * Let a pending sign-up in. They keep the floor rank they signed up with;
 * set rank and roles from User Management as usual. To turn a sign-up away,
 * delete the account (deleteUser), which frees the email to try again.
 */
export const approveUser = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { actorId, target } = await requireAdminActingOnSomeoneElse(ctx, args.userId, "approve");
    if (target.approvalStatus !== "pending") return null;
    await ctx.db.patch(args.userId, {
      approvalStatus: "approved",
      approvedAt: Date.now(),
      approvedBy: actorId,
    });
    return null;
  },
});
