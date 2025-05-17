import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get all module settings
 */
export const getModuleSettings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("moduleSettings").collect();
  },
});

/**
 * Initialize default module settings if they don't exist
 */
export const initializeModuleSettings = mutation({
  args: {},
  handler: async (ctx) => {
    // Define the default modules with role and rank requirements
    const defaultModules = [
      { 
        moduleId: "hoses", 
        moduleName: "Hose Inventory", 
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      { 
        moduleId: "keys", 
        moduleName: "Key Management", 
        isEnabled: true,
        adminOnly: false,
        requiredRoles: ["Key Manager"],
        minimumRank: "Firefighter" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      { 
        moduleId: "availability", 
        moduleName: "Availability", 
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      { 
        moduleId: "settings", 
        moduleName: "User Settings", 
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      { 
        moduleId: "admin", 
        moduleName: "Admin Settings", 
        isEnabled: true,
        adminOnly: true,
        requiredRoles: [],
        minimumRank: "Captain" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
    ];
    
    // Check if any module settings already exist
    const existingSettings = await ctx.db.query("moduleSettings").collect();
    
    // If no settings exist, create the defaults
    if (existingSettings.length === 0) {
      const timestamp = Date.now();
      
      for (const module of defaultModules) {
        await ctx.db.insert("moduleSettings", {
          ...module,
          updatedAt: timestamp,
          updatedBy: undefined,
        });
      }
    }
    
    return true;
  },
});

/**
 * Update a module's enabled status
 */
export const updateModuleStatus = mutation({
  args: {
    moduleId: v.string(),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { moduleId, isEnabled } = args;
    
    // Get the authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update module settings");
    }
    
    // Find the module setting
    const moduleSetting = await ctx.db
      .query("moduleSettings")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();
    
    if (!moduleSetting) {
      throw new Error(`Module with ID ${moduleId} not found`);
    }
    
    // Update the module setting
    await ctx.db.patch(moduleSetting._id, {
      isEnabled,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    
    return true;
  },
});

/**
 * Update a module's role and rank requirements
 */
export const updateModuleRequirements = mutation({
  args: {
    moduleId: v.string(),
    adminOnly: v.boolean(),
    requiredRoles: v.array(v.string()),
    minimumRank: v.optional(v.union(
      v.literal("Probationary"),
      v.literal("Firefighter"),
      v.literal("Lieutenant"),
      v.literal("Captain")
    )),
  },
  handler: async (ctx, args) => {
    const { moduleId, adminOnly, requiredRoles, minimumRank } = args;
    
    // Get the authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update module settings");
    }
    
    // Find the module setting
    const moduleSetting = await ctx.db
      .query("moduleSettings")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();
    
    if (!moduleSetting) {
      throw new Error(`Module with ID ${moduleId} not found`);
    }
    
    // Update the module setting
    await ctx.db.patch(moduleSetting._id, {
      adminOnly,
      requiredRoles,
      minimumRank,
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    
    return true;
  },
});

/**
 * Check if a user has access to a specific module
 */
export const checkModuleAccess = query({
  args: {
    moduleId: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { moduleId, userId } = args;
    
    // If no userId is provided, use the authenticated user
    let targetUserId = userId;
    if (!targetUserId) {
      const authUserId = await getAuthUserId(ctx);
      if (!authUserId) {
        return false; // Not authenticated
      }
      targetUserId = authUserId;
    }
    
    // Get the user
    const user = await ctx.db.get(targetUserId);
    if (!user) {
      return false; // User not found
    }
    
    // Admin users always have access to all modules
    if (user.isAdmin) {
      return true;
    }
    
    // Get the module settings
    const moduleSetting = await ctx.db
      .query("moduleSettings")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();
    
    if (!moduleSetting) {
      return false; // Module not found
    }
    
    // Check if the module is enabled globally
    if (!moduleSetting.isEnabled) {
      return false;
    }
    
    // Check if the module is admin-only
    if (moduleSetting.adminOnly && !user.isAdmin) {
      return false; // Module is admin-only and user is not an admin
    }
    
    // Check role requirements
    if (moduleSetting.requiredRoles && moduleSetting.requiredRoles.length > 0) {
      const userRoles = user.roles || [];
      const hasRequiredRole = moduleSetting.requiredRoles.some(role => userRoles.includes(role));
      if (!hasRequiredRole) {
        return false; // User doesn't have any of the required roles
      }
    }
    
    // Check rank requirements
    if (moduleSetting.minimumRank) {
      const rankOrder = {
        "Probationary": 1,
        "Firefighter": 2,
        "Lieutenant": 3,
        "Captain": 4
      };
      
      const userRank = user.rank;
      if (!userRank) {
        return false; // User has no rank
      }
      
      if (rankOrder[userRank] < rankOrder[moduleSetting.minimumRank]) {
        return false; // User's rank is too low
      }
    }
    
    // If all checks pass, the user has access
    return true;
  },
});
