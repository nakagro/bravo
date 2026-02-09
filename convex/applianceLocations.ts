import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Query to get all appliance locations
export const getApplianceLocations = query({
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
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    return await ctx.db.query("applianceLocations").collect();
  },
});

// Query to get all unique locations (for populating location options)
export const getAllLocations = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const locations = await ctx.db.query("applianceLocations").collect();
    const uniqueLocations = new Set<string>();
    
    // Always include the two main stations
    uniqueLocations.add("Main Station");
    uniqueLocations.add("Satellite Station");
    
    // Add any custom locations from the database
    locations.forEach(loc => {
      if (loc.stationLocation) {
        uniqueLocations.add(loc.stationLocation);
      }
    });
    
    return Array.from(uniqueLocations).sort();
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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Validate that stationLocation is not empty
    if (!args.stationLocation || args.stationLocation.trim() === "") {
      throw new Error("Station location cannot be empty");
    }
    // Get the authenticated user ID using the same pattern as other mutations
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update appliance locations");
    }
    
    // Get the current user data directly using the ID
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user is admin, has Lieutenant rank or higher, or has the Driver (DR) skill
    const rankOrder = {
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
          ctx.db.query("skills").filter((q) => q.eq(q.field("code"), code)).first()
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

    // Check if appliance location already exists
    const existingLocation = await ctx.db
      .query("applianceLocations")
      .filter((q) => q.eq(q.field("applianceName"), args.applianceName))
      .unique();

    if (existingLocation) {
      // Update existing location
      await ctx.db.patch(existingLocation._id, {
        stationLocation: args.stationLocation,
        updatedBy: user._id,
        updatedAt: Date.now(),
      });
    } else {
      // Create new location entry
      await ctx.db.insert("applianceLocations", {
        applianceName: args.applianceName,
        stationLocation: args.stationLocation,
        updatedBy: user._id,
        updatedAt: Date.now(),
      });
    }
  },
});

// Mutation to initialize default appliance locations (run once via Convex dashboard)
export const initializeApplianceLocations = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const appliances = ["Pumper", "Tanker", "FCV"] as const;
    
    // Get the first admin user to use as the updatedBy field
    const adminUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAdmin"), true))
      .first();

    if (!adminUser) {
      throw new Error("No admin user found. Please create an admin user first.");
    }
    
    for (const appliance of appliances) {
      const existing = await ctx.db
        .query("applianceLocations")
        .filter((q) => q.eq(q.field("applianceName"), appliance))
        .unique();

      if (!existing) {
        await ctx.db.insert("applianceLocations", {
          applianceName: appliance,
          stationLocation: "Main Station", // Default to Main Station
          updatedBy: adminUser._id,
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (!user.isAdmin) throw new Error("Admin access required");

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
    updatedBy: v.id("users"),
    updatedAt: v.number(),
    updatedByUser: v.optional(v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    })),
  })),
  handler: async (ctx) => {
    const locations = await ctx.db.query("applianceLocations").collect();
    
    // Fetch user details for each location
    const locationsWithUsers = await Promise.all(
      locations.map(async (location) => {
        const user = await ctx.db.get(location.updatedBy);
        return {
          ...location,
          updatedByUser: user ? {
            _id: user._id,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
          } : undefined,
        };
      })
    );
    
    return locationsWithUsers;
  },
});
