import { query, mutation, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  getActiveUser,
  isActiveAccount,
  isAdminUser,
  isSuperAdmin,
  requireAdmin,
  requireModule,
  userAllowsModuleSetting,
} from "./lib/access";

export { RANK_ORDER, moduleSettingAllows, userAllowsModuleSetting } from "./lib/access";

const MAX_ALLOWED_USERS = 200;

/**
 * Throw unless the signed-in user passes a moduleSettings-gated module. The gate
 * lives in data so officers can retune rank/role requirements from the Admin UI
 * without a code change. Super admins always pass; regular admins pass unless
 * the module is `superAdminOnly`. Returns the caller's user id.
 */
export async function requireModuleAccess(
  ctx: QueryCtx | MutationCtx,
  moduleId: string,
  denialMessage: string,
) {
  return (await requireModule(ctx, moduleId, denialMessage))._id;
}

/**
 * Get all module settings visible to the caller.
 * Modules marked `superAdminOnly` are hidden from non-super-admins so regular
 * administrators cannot see or alter pages locked behind super admin.
 */
export const getModuleSettings = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getActiveUser(ctx);
    if (!caller) return [];
    const all = await ctx.db.query("moduleSettings").collect();
    if (isSuperAdmin(caller)) return all;
    return all.filter((m) => !m.superAdminOnly);
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

    const caller = await requireAdmin(ctx, "change module settings");

    // Find the module setting
    const moduleSetting = await ctx.db
      .query("moduleSettings")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();

    if (!moduleSetting) {
      throw new Error(`Module with ID ${moduleId} not found`);
    }

    if (moduleSetting.superAdminOnly && !isSuperAdmin(caller)) {
      throw new ConvexError("Only super administrators can change a super-admin-only module");
    }

    await ctx.db.patch(moduleSetting._id, {
      config,
      updatedAt: Date.now(),
      updatedBy: caller._id,
    });

    return true;
  },
});

const DEFAULT_MODULES: Array<{
  moduleId: string;
  moduleName: string;
  isEnabled: boolean;
  adminOnly: boolean;
  superAdminOnly?: boolean;
  requiredRoles: string[];
  minimumRank: "Probationary" | "Firefighter" | "Lieutenant" | "Captain" | undefined;
  config?: Record<string, unknown>;
}> = [
  {
    moduleId: "dashboard",
    moduleName: "Dashboard",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "links",
    moduleName: "Links",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "hoses",
    moduleName: "Hose Inventory",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
    config: { defaultLocation: "Station" },
  },
  {
    moduleId: "keys",
    moduleName: "Key Management",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: ["Key Manager"],
    minimumRank: "Firefighter",
  },
  {
    moduleId: "availability",
    moduleName: "Availability",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "availabilityAdmin",
    moduleName: "Availability Admin Tab",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "dutyCrew",
    moduleName: "Duty Crew",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "fireReports",
    moduleName: "Fire Reports",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Firefighter",
  },
  {
    moduleId: "inventory",
    moduleName: "Inventory",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Probationary",
  },
  {
    moduleId: "inventoryAdmin",
    moduleName: "Inventory - Templates",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "memberRecords",
    moduleName: "Member Records",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "memberRecordsAdmin",
    moduleName: "Member Records - Kit",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "vehicleFaults",
    moduleName: "Vehicle Faults",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Probationary",
  },
  {
    moduleId: "bookings",
    moduleName: "Bookings",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "bookingsAdmin",
    moduleName: "Bookings Admin",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "settings",
    moduleName: "User Settings",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "feedback",
    moduleName: "Feedback",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "equipment",
    moduleName: "Equipment",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Probationary",
  },
  {
    moduleId: "equipmentAdmin",
    moduleName: "Equipment Admin",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "baSkills",
    moduleName: "BA Skills Maintenance",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Probationary",
  },
  {
    moduleId: "baSkillsAdmin",
    moduleName: "BA Skills Admin",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "training",
    moduleName: "Training Roll",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "events",
    moduleName: "Events",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "eventsAdmin",
    moduleName: "Events Admin",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "calendar",
    moduleName: "Calendar (Read)",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "calendarWrite",
    moduleName: "Calendar (Write)",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "actions",
    moduleName: "Action Centre",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "kiosk",
    moduleName: "Kiosk Mode",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    minimumRank: undefined,
  },
  {
    moduleId: "accessControl",
    moduleName: "Access Control",
    isEnabled: true,
    adminOnly: false,
    superAdminOnly: true,
    requiredRoles: [],
    minimumRank: "Lieutenant",
  },
  {
    moduleId: "admin",
    moduleName: "Admin Settings",
    isEnabled: true,
    adminOnly: true,
    requiredRoles: [],
    minimumRank: "Captain",
  },
];

async function syncModuleSettingsImpl(ctx: MutationCtx) {
  const existingSettings = await ctx.db.query("moduleSettings").collect();
  const existingModuleIds = new Set(existingSettings.map((setting) => setting.moduleId));

  const timestamp = Date.now();
  let addedCount = 0;

  for (const module of DEFAULT_MODULES) {
    if (!existingModuleIds.has(module.moduleId)) {
      await ctx.db.insert("moduleSettings", {
        ...module,
        updatedAt: timestamp,
        updatedBy: undefined,
      });
      addedCount++;
    }
  }

  return { addedCount, totalModules: DEFAULT_MODULES.length };
}

/**
 * Sync missing modules to existing module settings
 */
export const syncModuleSettings = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, "change module settings");
    return await syncModuleSettingsImpl(ctx);
  },
});

/**
 * Internal variant for CLI/ops sync (`npx convex run modules:syncModuleSettingsInternal`).
 */
export const syncModuleSettingsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await syncModuleSettingsImpl(ctx);
  },
});

/**
 * Internal CLI helper to lock or unlock a module as super-admin-only on an
 * existing deployment (e.g. `npx convex run modules:setModuleSuperAdminOnlyInternal '{"moduleId":"accessControl","superAdminOnly":true}'`).
 */
export const setModuleSuperAdminOnlyInternal = internalMutation({
  args: {
    moduleId: v.string(),
    superAdminOnly: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, { moduleId, superAdminOnly }) => {
    const existing = await ctx.db
      .query("moduleSettings")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();
    if (!existing) {
      throw new Error(`Module with ID ${moduleId} not found`);
    }
    await ctx.db.patch(existing._id, {
      superAdminOnly,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/**
 * Initialize default module settings if they don't exist
 */
export const initializeModuleSettings = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx, "change module settings");

    const existingSettings = await ctx.db.query("moduleSettings").collect();
    if (existingSettings.length === 0) {
      const timestamp = Date.now();
      for (const module of DEFAULT_MODULES) {
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

    const caller = await requireAdmin(ctx, "change module settings");

    const moduleSetting = await ctx.db
      .query("moduleSettings")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();

    if (!moduleSetting) {
      throw new Error(`Module with ID ${moduleId} not found`);
    }

    if (moduleSetting.superAdminOnly && !isSuperAdmin(caller)) {
      throw new ConvexError("Only super administrators can change a super-admin-only module");
    }

    await ctx.db.patch(moduleSetting._id, {
      isEnabled,
      updatedAt: Date.now(),
      updatedBy: caller._id,
    });

    return true;
  },
});

/**
 * Update a module's role, rank, admin, super-admin, and individual user requirements
 */
export const updateModuleRequirements = mutation({
  args: {
    moduleId: v.string(),
    adminOnly: v.boolean(),
    superAdminOnly: v.optional(v.boolean()),
    allowedUserIds: v.optional(v.array(v.id("users"))),
    requiredRoles: v.array(v.string()),
    minimumRank: v.optional(
      v.union(
        v.literal("Brigade Member"),
        v.literal("Probationary"),
        v.literal("Firefighter"),
        v.literal("Lieutenant"),
        v.literal("Captain"),
      ),
    ),
    requirementMode: v.optional(v.union(v.literal("all"), v.literal("any"))),
  },
  handler: async (ctx, args) => {
    const {
      moduleId,
      adminOnly,
      superAdminOnly,
      allowedUserIds,
      requiredRoles,
      minimumRank,
      requirementMode,
    } = args;

    const caller = await requireAdmin(ctx, "change module settings");

    const moduleSetting = await ctx.db
      .query("moduleSettings")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();

    if (!moduleSetting) {
      throw new Error(`Module with ID ${moduleId} not found`);
    }

    const currentlySuperAdminOnly = moduleSetting.superAdminOnly === true;
    const changingSuperAdminOnly =
      superAdminOnly !== undefined && superAdminOnly !== currentlySuperAdminOnly;
    if ((currentlySuperAdminOnly || changingSuperAdminOnly) && !isSuperAdmin(caller)) {
      throw new ConvexError("Only super administrators can change super-admin-only module access");
    }

    const dedupedAllowed =
      allowedUserIds !== undefined ? Array.from(new Set(allowedUserIds)) : undefined;
    if (dedupedAllowed && dedupedAllowed.length > MAX_ALLOWED_USERS) {
      throw new ConvexError(`At most ${MAX_ALLOWED_USERS} individual users can be listed per module`);
    }

    await ctx.db.patch(moduleSetting._id, {
      adminOnly,
      ...(superAdminOnly !== undefined ? { superAdminOnly } : {}),
      ...(dedupedAllowed !== undefined ? { allowedUserIds: dedupedAllowed } : {}),
      requiredRoles,
      minimumRank,
      requirementMode: requirementMode ?? "all",
      updatedAt: Date.now(),
      updatedBy: caller._id,
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

    // Only admins may ask about someone else.
    const caller = await getActiveUser(ctx);
    if (!caller) return false;
    if (userId && userId !== caller._id && !isAdminUser(caller)) return false;

    const user = userId ? await ctx.db.get(userId) : caller;
    if (!user || !isActiveAccount(user)) {
      return false;
    }

    if (isSuperAdmin(user)) {
      return true;
    }

    const moduleSetting = await ctx.db
      .query("moduleSettings")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();

    return userAllowsModuleSetting(user, moduleSetting);
  },
});

const ALL_FALSE_ACCESS = {
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
  training: false,
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
  accessControl: false,
  admin: false,
  actions: false,
};

const ALL_TRUE_ACCESS = {
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
  training: true,
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
  accessControl: true,
  admin: true,
  actions: true,
};

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
    training: v.boolean(),
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
    accessControl: v.boolean(),
    admin: v.boolean(),
    actions: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return ALL_FALSE_ACCESS;

    const user = await ctx.db.get(userId);
    if (!user || !isActiveAccount(user)) return ALL_FALSE_ACCESS;

    // Super admin users always have access to everything
    if (isSuperAdmin(user)) return ALL_TRUE_ACCESS;

    // Get all module settings in one query (regular admins still get checked
    // against `superAdminOnly` modules here).
    const allModuleSettings = await ctx.db.query("moduleSettings").collect();
    const moduleMap = new Map(allModuleSettings.map((m) => [m.moduleId, m]));

    const checkAccess = (moduleId: string): boolean =>
      userAllowsModuleSetting(user, moduleMap.get(moduleId));

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
      // The current Duty Officer reaches the roll to record apologies, even
      // without the module; convex/training.ts limits them to that
      training: checkAccess("training") || (user.isDutyOfficer === true && !user.isDisabled),
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
      accessControl: checkAccess("accessControl"),
      admin: checkAccess("admin"),
      actions: checkAccess("actions"),
    };
  },
});
