import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

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
