import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
 * Update a user's rank
 */
export const updateUserRank = mutation({
  args: {
    userId: v.id("users"),
    rank: v.union(
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
 * Delete a user and their associated auth accounts
 * This ensures the email can be reused after deletion
 */
export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = args;
    
    // Verify the user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Find and delete all auth accounts associated with this user
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    
    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }
    
    // Delete the user
    await ctx.db.delete(userId);
    
    return null;
  },
});
