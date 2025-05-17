import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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
    const { roleId, ...updates } = args;
    
    // Verify the role exists
    const role = await ctx.db.get(roleId);
    if (!role) {
      throw new Error(`Role with ID ${roleId} not found`);
    }
    
    // Update the role
    await ctx.db.patch(roleId, {
      ...updates,
      updatedAt: Date.now(),
    });
    
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
