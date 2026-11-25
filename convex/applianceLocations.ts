import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { getActiveUser, getKioskServiceAccount, getModuleUser, requireAdmin } from "./lib/access";

/** Members who can open the availability page, or the kiosk tablet. */
async function canSeeLocations(ctx: QueryCtx, serviceToken: string | undefined) {
  return !!(await getModuleUser(ctx, "availability")) || !!(await getKioskServiceAccount(ctx, serviceToken));
}

// Who last moved an appliance. "kioskHub" is a station kiosk hub writing
// through /api/kiosk/v1 (convex/kioskApi.ts); it sets updatedByKioskSite and,
// when the tablet is known, updatedByKioskDevice.
const applianceLocationSourceValidator = v.union(
  v.literal("user"),
  v.literal("serviceAccount"),
  v.literal("kioskHub"),
);

/** The location options: the two stations plus any custom location in use. */
export function knownLocationsFrom(rows: Array<{ stationLocation: string }>): string[] {
  const uniqueLocations = new Set<string>(["Main Station", "Satellite Station"]);
  for (const row of rows) {
    if (row.stationLocation) uniqueLocations.add(row.stationLocation);
  }
  return Array.from(uniqueLocations).sort();
}

// Query to get all appliance locations
export const getApplianceLocations = query({
  args: { serviceToken: v.optional(v.string()) },
  returns: v.array(v.object({
    _id: v.id("applianceLocations"),
    _creationTime: v.number(),
    applianceName: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
    stationLocation: v.string(),
    updatedBy: v.optional(v.id("users")),
    updatedByServiceAccount: v.optional(v.id("serviceAccounts")),
    updatedBySource: v.optional(applianceLocationSourceValidator),
    updatedByKioskSite: v.optional(v.string()),
    updatedByKioskDevice: v.optional(v.string()),
    updatedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    if (!(await canSeeLocations(ctx, args.serviceToken))) return [];
    return await ctx.db.query("applianceLocations").collect();
  },
});

// Query to get all unique locations (for populating location options)
export const getAllLocations = query({
  args: { serviceToken: v.optional(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    if (!(await canSeeLocations(ctx, args.serviceToken))) return [];
    const locations = await ctx.db.query("applianceLocations").collect();
    return knownLocationsFrom(locations);
  },
});

// Mutation to update an appliance location
export const updateApplianceLocation = mutation({
  args: {
    applianceName: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
    stationLocation: v.string(), // Now accepts any string including custom locations
    serviceToken: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Validate that stationLocation is not empty
    if (!args.stationLocation || args.stationLocation.trim() === "") {
      throw new Error("Station location cannot be empty");
    }

    const now = Date.now();
    const stationLocation = args.stationLocation.trim();

    // Try normal user auth first
    const activeUser = await getActiveUser(ctx);
    let updatedBy: Id<"users"> | undefined;
    let updatedByServiceAccount: Id<"serviceAccounts"> | undefined;
    let updatedBySource: "user" | "serviceAccount";

    if (activeUser) {
      const user = activeUser;

      // Check if user is admin, has Lieutenant rank or higher, or has the Driver (DR) skill
      const rankOrder = {
        "Brigade Member": 0,
        "Probationary": 1,
        "Firefighter": 2,
        "Lieutenant": 3,
        "Captain": 4
      };

      const userRank = user.rank;
      const hasRequiredRank = userRank && rankOrder[userRank] >= rankOrder["Lieutenant"];

      // Check if user has an authorized skill (configurable via admin settings)
      let hasAuthorizedSkill = false;
      if (user.skills && user.skills.length > 0) {
        const authorizedCodes = await getLocationEditSkillCodes(ctx);
        const authorizedSkills = await Promise.all(
          authorizedCodes.map((code) =>
            ctx.db
              .query("skills")
              .withIndex("by_code", (q) => q.eq("code", code))
              .first()
          )
        );
        const authorizedSkillIds = authorizedSkills
          .filter((s): s is NonNullable<typeof s> => s !== null)
          .map((s) => s._id);
        hasAuthorizedSkill = user.skills.some((id: any) => authorizedSkillIds.includes(id));
      }

      if (!user.isAdmin && !hasRequiredRank && !hasAuthorizedSkill) {
        throw new Error("Not authorized to update appliance locations.");
      }

      updatedBy = user._id;
      updatedBySource = "user";
    } else {
      const serviceAccount = await getKioskServiceAccount(ctx, args.serviceToken);
      if (!serviceAccount) {
        throw new Error("You must be signed in to update appliance locations");
      }

      updatedByServiceAccount = serviceAccount._id;
      updatedBySource = "serviceAccount";
    }

    // Check if appliance location already exists
    const existingLocation = await ctx.db
      .query("applianceLocations")
      .withIndex("by_applianceName", (q) => q.eq("applianceName", args.applianceName))
      .unique();

    if (existingLocation) {
      // Update existing location
      await ctx.db.patch(existingLocation._id, {
        stationLocation,
        ...(updatedBy ? { updatedBy } : {}),
        ...(updatedByServiceAccount ? { updatedByServiceAccount } : {}),
        updatedBySource,
        // A hub's attribution must not outlive the hub's write.
        updatedByKioskSite: undefined,
        updatedByKioskDevice: undefined,
        updatedAt: now,
      });
    } else {
      // Create new location entry
      await ctx.db.insert("applianceLocations", {
        applianceName: args.applianceName,
        stationLocation,
        ...(updatedBy ? { updatedBy } : {}),
        ...(updatedByServiceAccount ? { updatedByServiceAccount } : {}),
        updatedBySource,
        updatedAt: now,
      });
    }
  },
});

// Mutation to initialize default appliance locations (run once via Convex dashboard)
export const initializeApplianceLocations = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx, "set up appliance locations");
    const appliances = ["Pumper", "Tanker", "FCV"] as const;
    
    // Get the first admin user to use as the updatedBy field
    const adminUser = await ctx.db
      .query("users")
      .withIndex("by_isAdmin", (q) => q.eq("isAdmin", true))
      .first();

    if (!adminUser) {
      throw new Error("No admin user found. Please create an admin user first.");
    }
    
    for (const appliance of appliances) {
      const existing = await ctx.db
        .query("applianceLocations")
        .withIndex("by_applianceName", (q) => q.eq("applianceName", appliance))
        .unique();

      if (!existing) {
        await ctx.db.insert("applianceLocations", {
          applianceName: appliance,
          stationLocation: "Main Station", // Default to Main Station
          updatedBy: adminUser._id,
          updatedBySource: "user",
          updatedAt: Date.now(),
        });
      }
    }
    
    console.log("Appliance locations initialized successfully");
  },
});

// Default skill codes that can edit appliance locations
const DEFAULT_LOCATION_EDIT_SKILLS = ["DR", "DR3", "OF", "CL"];

// Helper to get configured skill codes from moduleSettings
async function getLocationEditSkillCodes(ctx: any): Promise<string[]> {
  const moduleSetting = await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q: any) => q.eq("moduleId", "availability"))
    .first();
  const config = moduleSetting?.config as { applianceLocationEditSkills?: string[] } | undefined;
  return config?.applianceLocationEditSkills ?? DEFAULT_LOCATION_EDIT_SKILLS;
}

// Query to get the configured skill codes for appliance location editing
export const getLocationEditSkills = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    if (!(await getModuleUser(ctx, "availability"))) return [];
    return await getLocationEditSkillCodes(ctx);
  },
});

// Mutation to update which skills can edit appliance locations (admin only)
export const updateLocationEditSkills = mutation({
  args: {
    skillCodes: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = (await requireAdmin(ctx, "change who can move appliances"))._id;

    const moduleSetting = await ctx.db
      .query("moduleSettings")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", "availability"))
      .first();

    if (!moduleSetting) {
      throw new Error("Availability module settings not found. Run syncModuleSettings first.");
    }

    const existingConfig = (moduleSetting.config as Record<string, any>) || {};
    await ctx.db.patch(moduleSetting._id, {
      config: { ...existingConfig, applianceLocationEditSkills: args.skillCodes },
      updatedAt: Date.now(),
      updatedBy: userId,
    });
    return null;
  },
});

// Query to get appliance locations with user details for admin tab
export const getApplianceLocationsWithUsers = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("applianceLocations"),
    _creationTime: v.number(),
    applianceName: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
    stationLocation: v.string(),
    updatedBy: v.optional(v.id("users")),
    updatedByServiceAccount: v.optional(v.id("serviceAccounts")),
    updatedBySource: v.optional(applianceLocationSourceValidator),
    updatedByKioskSite: v.optional(v.string()),
    updatedByKioskDevice: v.optional(v.string()),
    updatedAt: v.number(),
    updatedByUser: v.optional(v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    })),
    updatedByServiceAccountInfo: v.optional(v.object({
      _id: v.id("serviceAccounts"),
      name: v.string(),
      description: v.optional(v.string()),
    })),
  })),
  handler: async (ctx) => {
    if (!(await getModuleUser(ctx, "availability"))) return [];
    const locations = await ctx.db.query("applianceLocations").collect();
    
    // Fetch user details for each location
    const locationsWithUsers = await Promise.all(
      locations.map(async (location) => {
        const user = location.updatedBy
          ? await ctx.db.get(location.updatedBy)
          : null;
        const serviceAccount = location.updatedByServiceAccount
          ? await ctx.db.get(location.updatedByServiceAccount)
          : null;
        return {
          ...location,
          updatedByUser: user ? {
            _id: user._id,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
          } : undefined,
          updatedByServiceAccountInfo: serviceAccount ? {
            _id: serviceAccount._id,
            name: serviceAccount.name,
            description: serviceAccount.description,
          } : undefined,
        };
      })
    );
    
    return locationsWithUsers;
  },
});
