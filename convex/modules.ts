import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "./_generated/dataModel";

/**
 * The single rank ladder. It lived in three places (two here, one in the member
 * records module) and every new rank meant finding all of them. "Brigade
 * Member" was added by hand to each. Keep it here and import it.
 */
export const RANK_ORDER: Record<string, number> = {
  "Brigade Member": 0,
  Probationary: 1,
  Firefighter: 2,
  Lieutenant: 3,
  Captain: 4,
};

/**
 * Does this user satisfy a module's gate? A missing or disabled module denies.
 * Admins are handled by the callers, which short-circuit before getting here.
 *
 * When both a role list and a minimum rank are set, `requirementMode` decides
 * how they combine: "all" (the default, and what every row written before this
 * field existed means) requires both, "any" requires either. "any" exists for
 * gates like Events Admin, where the officers qualify on rank and the social
 * crew qualify on role, and nobody should need both.
 */
export function moduleSettingAllows(
  user: Doc<"users">,
  moduleSetting: Doc<"moduleSettings"> | null | undefined,
): boolean {
  if (!moduleSetting || !moduleSetting.isEnabled) return false;
  // A disabled account keeps its rank and roles (so re-enabling is a single
  // switch) but reaches nothing while it's off - including admin-only modules.
  if (user.isDisabled) return false;
  if (moduleSetting.adminOnly && !user.isAdmin) return false;

  const hasRoleReq = !!(moduleSetting.requiredRoles && moduleSetting.requiredRoles.length > 0);
  const hasRankReq = !!moduleSetting.minimumRank;

  let roleOk = true;
  if (hasRoleReq) {
    const userRoles = user.roles || [];
    roleOk = moduleSetting.requiredRoles!.some((role: string) => userRoles.includes(role));
  }

  let rankOk = true;
  if (hasRankReq) {
    const userRank = user.rank;
    rankOk = userRank ? RANK_ORDER[userRank] >= RANK_ORDER[moduleSetting.minimumRank!] : false;
  }

  // The mode only means anything when there are two requirements to combine.
  if (hasRoleReq && hasRankReq && moduleSetting.requirementMode === "any") {
    return roleOk || rankOk;
  }

  return roleOk && rankOk;
}

/**
 * Throw unless the signed-in user passes a moduleSettings-gated module. The gate
 * lives in data so officers can retune rank/role requirements from the Admin UI
 * without a code change. Admins always pass. Returns the caller's user id.
 */
export async function requireModuleAccess(
  ctx: QueryCtx | MutationCtx,
  moduleId: string,
  denialMessage: string,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in");

  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  if (user.isAdmin) return userId;

  const moduleSetting = await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
    .first();

  if (!moduleSettingAllows(user, moduleSetting)) throw new Error(denialMessage);

  return userId;
}

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
        moduleId: "memberRecords",
        moduleName: "Member Records",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "memberRecordsAdmin",
        moduleName: "Member Records - Kit",
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
        moduleId: "bookingsAdmin",
        moduleName: "Bookings Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
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
        moduleId: "events",
        moduleName: "Events",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "eventsAdmin",
        moduleName: "Events Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "calendar",
        moduleName: "Calendar (Read)",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "calendarWrite",
        moduleName: "Calendar (Write)",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "actions",
        moduleName: "Action Centre",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "kiosk",
        moduleName: "Kiosk Mode",
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
        moduleId: "memberRecords",
        moduleName: "Member Records",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "memberRecordsAdmin",
        moduleName: "Member Records - Kit",
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
        moduleId: "bookingsAdmin",
        moduleName: "Bookings Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
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
        moduleId: "events",
        moduleName: "Events",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "eventsAdmin",
        moduleName: "Events Admin",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "calendar",
        moduleName: "Calendar (Read)",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "calendarWrite",
        moduleName: "Calendar (Write)",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: "Lieutenant" as "Probationary" | "Firefighter" | "Lieutenant" | "Captain"
      },
      {
        moduleId: "actions",
        moduleName: "Action Centre",
        isEnabled: true,
        adminOnly: false,
        requiredRoles: [],
        minimumRank: undefined
      },
      {
        moduleId: "kiosk",
        moduleName: "Kiosk Mode",
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
      v.literal("Brigade Member"),
      v.literal("Probationary"),
      v.literal("Firefighter"),
      v.literal("Lieutenant"),
      v.literal("Captain")
    )),
    requirementMode: v.optional(v.union(v.literal("all"), v.literal("any"))),
  },
  handler: async (ctx, args) => {
    const { moduleId, adminOnly, requiredRoles, minimumRank, requirementMode } = args;

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
      requirementMode: requirementMode ?? "all",
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

    return moduleSettingAllows(user, moduleSetting);
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
    availabilityAdmin: v.boolean(),
    dutyCrew: v.boolean(),
    fireReports: v.boolean(),
    inventory: v.boolean(),
    inventoryAdmin: v.boolean(),
    memberRecords: v.boolean(),
    memberRecordsAdmin: v.boolean(),
    vehicleFaults: v.boolean(),
    equipment: v.boolean(),
    equipmentAdmin: v.boolean(),
    baSkills: v.boolean(),
    baSkillsAdmin: v.boolean(),
    bookings: v.boolean(),
    bookingsAdmin: v.boolean(),
    events: v.boolean(),
    eventsAdmin: v.boolean(),
    calendar: v.boolean(),
    calendarWrite: v.boolean(),
    feedback: v.boolean(),
    links: v.boolean(),
    settings: v.boolean(),
    kiosk: v.boolean(),
    admin: v.boolean(),
    actions: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        dashboard: false,
        hoses: false,
        keys: false,
        availability: false,
        availabilityAdmin: false,
        dutyCrew: false,
        fireReports: false,
        inventory: false,
        inventoryAdmin: false,
        memberRecords: false,
        memberRecordsAdmin: false,
        vehicleFaults: false,
        equipment: false,
        equipmentAdmin: false,
        baSkills: false,
        baSkillsAdmin: false,
        bookings: false,
        bookingsAdmin: false,
        events: false,
        eventsAdmin: false,
        calendar: false,
        calendarWrite: false,
        feedback: false,
        links: false,
        settings: false,
        kiosk: false,
        admin: false,
        actions: false,
      };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return {
        dashboard: false,
        hoses: false,
        keys: false,
        availability: false,
        availabilityAdmin: false,
        dutyCrew: false,
        fireReports: false,
        inventory: false,
        inventoryAdmin: false,
        memberRecords: false,
        memberRecordsAdmin: false,
        vehicleFaults: false,
        equipment: false,
        equipmentAdmin: false,
        baSkills: false,
        baSkillsAdmin: false,
        bookings: false,
        bookingsAdmin: false,
        events: false,
        eventsAdmin: false,
        calendar: false,
        calendarWrite: false,
        feedback: false,
        links: false,
        settings: false,
        kiosk: false,
        admin: false,
        actions: false,
      };
    }

    // Admin users have access to everything
    if (user.isAdmin) {
      return {
        dashboard: true,
        hoses: true,
        keys: true,
        availability: true,
        availabilityAdmin: true,
        dutyCrew: true,
        fireReports: true,
        inventory: true,
        inventoryAdmin: true,
        memberRecords: true,
        memberRecordsAdmin: true,
        vehicleFaults: true,
        equipment: true,
        equipmentAdmin: true,
        baSkills: true,
        baSkillsAdmin: true,
        bookings: true,
        bookingsAdmin: true,
        events: true,
        eventsAdmin: true,
        calendar: true,
        calendarWrite: true,
        feedback: true,
        links: true,
        settings: true,
        kiosk: true,
        admin: true,
        actions: true,
      };
    }

    // Get all module settings in one query
    const allModuleSettings = await ctx.db.query("moduleSettings").collect();
    const moduleMap = new Map(allModuleSettings.map(m => [m.moduleId, m]));

    // Helper function to check access for a specific module
    const checkAccess = (moduleId: string): boolean =>
      moduleSettingAllows(user, moduleMap.get(moduleId));

    return {
      dashboard: checkAccess("dashboard"),
      hoses: checkAccess("hoses"),
      keys: checkAccess("keys"),
      availability: checkAccess("availability"),
      availabilityAdmin: checkAccess("availabilityAdmin"),
      dutyCrew: checkAccess("dutyCrew"),
      fireReports: checkAccess("fireReports"),
      inventory: checkAccess("inventory"),
      inventoryAdmin: checkAccess("inventoryAdmin"),
      memberRecords: checkAccess("memberRecords"),
      memberRecordsAdmin: checkAccess("memberRecordsAdmin"),
      vehicleFaults: checkAccess("vehicleFaults"),
      equipment: checkAccess("equipment"),
      equipmentAdmin: checkAccess("equipmentAdmin"),
      baSkills: checkAccess("baSkills"),
      baSkillsAdmin: checkAccess("baSkillsAdmin"),
      bookings: checkAccess("bookings"),
      bookingsAdmin: checkAccess("bookingsAdmin"),
      events: checkAccess("events"),
      eventsAdmin: checkAccess("eventsAdmin"),
      calendar: checkAccess("calendar"),
      calendarWrite: checkAccess("calendarWrite"),
      feedback: checkAccess("feedback"),
      links: checkAccess("links"),
      settings: checkAccess("settings"),
      kiosk: checkAccess("kiosk"),
      admin: checkAccess("admin"),
      actions: checkAccess("actions"),
    };
  },
});
