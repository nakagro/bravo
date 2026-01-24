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
 * Update a module's configuration object
 */
export const updateModuleConfig = mutation({
  args: {
    moduleId: v.string(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    const { moduleId, config } = args;

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

    await ctx.db.patch(moduleSetting._id, {
      config,
      updatedAt: Date.now(),
      updatedBy: userId,
    });

    return true;
  },
});

/**
 * Sync missing modules to existing module settings
 */
export const syncModuleSettings = mutation({
  args: {},
  handler: async (ctx) => {
    // Define the default modules with role and rank requirements
    const defaultModules = [
      {
        moduleId: "dashboard",
        moduleName: "Dashboard",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "links",
        moduleName: "Links",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "hoses",
        moduleName: "Hose Inventory",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined,
        config: { defaultLocation: "Station" }
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
        moduleId: "availabilityAdmin",
        moduleName: "Availability Admin Tab",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "dutyCrew",
        moduleName: "Duty Crew",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "fireReports",
        moduleName: "Fire Reports",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Firefighter" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "inventory",
        moduleName: "Inventory",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "inventoryAdmin",
        moduleName: "Inventory - Templates",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "vehicleFaults",
        moduleName: "Vehicle Faults",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "bookings",
        moduleName: "Bookings",
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
        moduleId: "feedback",
        moduleName: "Feedback",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "equipment",
        moduleName: "Equipment",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "equipmentAdmin",
        moduleName: "Equipment Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "baSkills",
        moduleName: "BA Skills Maintenance",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "baSkillsAdmin",
        moduleName: "BA Skills Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "brigadeTasks",
        moduleName: "Brigade Tasks",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
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

    // Get existing settings
    const existingSettings = await ctx.db.query("moduleSettings").collect();
    const existingModuleIds = new Set(existingSettings.map(setting => setting.moduleId));

    // Add missing modules
    const timestamp = Date.now();
    let addedCount = 0;

    for (const module of defaultModules) {
      if (!existingModuleIds.has(module.moduleId)) {
        await ctx.db.insert("moduleSettings", {
          ...module,
          updatedAt: timestamp,
          updatedBy: undefined,
        });
        addedCount++;
      }
    }

    return { addedCount, totalModules: defaultModules.length };
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
        moduleId: "dashboard",
        moduleName: "Dashboard",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "links",
        moduleName: "Links",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "hoses",
        moduleName: "Hose Inventory",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined,
        config: { defaultLocation: "Station" }
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
        moduleId: "availabilityAdmin",
        moduleName: "Availability Admin Tab",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "dutyCrew",
        moduleName: "Duty Crew",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "fireReports",
        moduleName: "Fire Reports",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Firefighter" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "inventory",
        moduleName: "Inventory",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "inventoryAdmin",
        moduleName: "Inventory - Templates",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "vehicleFaults",
        moduleName: "Vehicle Faults",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "bookings",
        moduleName: "Bookings",
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
        moduleId: "feedback",
        moduleName: "Feedback",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "equipment",
        moduleName: "Equipment",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "equipmentAdmin",
        moduleName: "Equipment Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "baSkills",
        moduleName: "BA Skills Maintenance",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "baSkillsAdmin",
        moduleName: "BA Skills Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "brigadeTasks",
        moduleName: "Brigade Tasks",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Probationary" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
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
    const hasRoleReq = !!(moduleSetting.requiredRoles && moduleSetting.requiredRoles.length > 0);
    const hasRankReq = !!moduleSetting.minimumRank;

    let roleOk = true;
    if (hasRoleReq) {
      const userRoles = user.roles || [];
      roleOk = moduleSetting.requiredRoles!.some(role => userRoles.includes(role));
    }

    let rankOk = true;
    if (hasRankReq) {
      const rankOrder = {
        "Probationary": 1,
        "Firefighter": 2,
        "Lieutenant": 3,
        "Captain": 4
      };

      const userRank = user.rank;
      if (!userRank) {
        rankOk = false;
      } else {
        rankOk = rankOrder[userRank] >= rankOrder[moduleSetting.minimumRank as keyof typeof rankOrder];
      }
    }

    // When both role and rank requirements exist, user must meet BOTH
    // When only one requirement exists, user must meet that one
    if (!(roleOk && rankOk)) return false;

    // If all checks pass, the user has access
    return true;
  },
});

/**
 * Get all module access permissions for the current user in a single query
 * This is optimized to reduce query overhead compared to calling checkModuleAccess multiple times
 */
export const getAllModuleAccess = query({
  args: {},
  returns: v.object({
    dashboard: v.boolean(),
    hoses: v.boolean(),
    keys: v.boolean(),
    availability: v.boolean(),
    dutyCrew: v.boolean(),
    fireReports: v.boolean(),
    inventory: v.boolean(),
    vehicleFaults: v.boolean(),
    equipment: v.boolean(),
    equipmentAdmin: v.boolean(),
    baSkills: v.boolean(),
    baSkillsAdmin: v.boolean(),
    brigadeTasks: v.boolean(),
    bookings: v.boolean(),
    feedback: v.boolean(),
    links: v.boolean(),
    settings: v.boolean(),
    admin: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // Return all false if not authenticated
      return {
        dashboard: false,
        hoses: false,
        keys: false,
        availability: false,
        dutyCrew: false,
        fireReports: false,
        inventory: false,
        vehicleFaults: false,
        equipment: false,
        equipmentAdmin: false,
        baSkills: false,
        baSkillsAdmin: false,
        brigadeTasks: false,
        bookings: false,
        feedback: false,
        links: false,
        settings: false,
        admin: false,
      };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return {
        dashboard: false,
        hoses: false,
        keys: false,
        availability: false,
        dutyCrew: false,
        fireReports: false,
        inventory: false,
        vehicleFaults: false,
        equipment: false,
        equipmentAdmin: false,
        baSkills: false,
        baSkillsAdmin: false,
        brigadeTasks: false,
        bookings: false,
        feedback: false,
        links: false,
        settings: false,
        admin: false,
      };
    }

    // Admin users have access to everything
    if (user.isAdmin) {
      return {
        dashboard: true,
        hoses: true,
        keys: true,
        availability: true,
        dutyCrew: true,
        fireReports: true,
        inventory: true,
        vehicleFaults: true,
        equipment: true,
        equipmentAdmin: true,
        baSkills: true,
        baSkillsAdmin: true,
        brigadeTasks: true,
        bookings: true,
        feedback: true,
        links: true,
        settings: true,
        admin: true,
      };
    }

    // Get all module settings in one query
    const allModuleSettings = await ctx.db.query("moduleSettings").collect();
    const moduleMap = new Map(allModuleSettings.map(m => [m.moduleId, m]));

    // Helper function to check access for a specific module
    const checkAccess = (moduleId: string): boolean => {
      const moduleSetting = moduleMap.get(moduleId);
      if (!moduleSetting || !moduleSetting.isEnabled) {
        return false;
      }

      if (moduleSetting.adminOnly && !user.isAdmin) {
        return false;
      }

      const hasRoleReq = !!(moduleSetting.requiredRoles && moduleSetting.requiredRoles.length > 0);
      const hasRankReq = !!moduleSetting.minimumRank;

      let roleOk = true;
      if (hasRoleReq) {
        const userRoles = user.roles || [];
        roleOk = moduleSetting.requiredRoles!.some(role => userRoles.includes(role));
      }

      let rankOk = true;
      if (hasRankReq) {
        const rankOrder = {
          "Probationary": 1,
          "Firefighter": 2,
          "Lieutenant": 3,
          "Captain": 4
        };

        const userRank = user.rank;
        if (!userRank) {
          rankOk = false;
        } else {
          rankOk = rankOrder[userRank] >= rankOrder[moduleSetting.minimumRank as keyof typeof rankOrder];
        }
      }

      // When both role and rank requirements exist, user must meet BOTH
      // When only one requirement exists, user must meet that one
      if (!(roleOk && rankOk)) return false;

      return true;
    };

    return {
      dashboard: checkAccess("dashboard"),
      hoses: checkAccess("hoses"),
      keys: checkAccess("keys"),
      availability: checkAccess("availability"),
      dutyCrew: checkAccess("dutyCrew"),
      fireReports: checkAccess("fireReports"),
      inventory: checkAccess("inventory"),
      vehicleFaults: checkAccess("vehicleFaults"),
      equipment: checkAccess("equipment"),
      equipmentAdmin: checkAccess("equipmentAdmin"),
      baSkills: checkAccess("baSkills"),
      baSkillsAdmin: checkAccess("baSkillsAdmin"),
      brigadeTasks: checkAccess("brigadeTasks"),
      bookings: checkAccess("bookings"),
      feedback: checkAccess("feedback"),
      links: checkAccess("links"),
      settings: checkAccess("settings"),
      admin: checkAccess("admin"),
    };
  },
});
