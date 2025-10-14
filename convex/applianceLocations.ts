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
    stationLocation: v.union(
      v.literal("Main Station"),
      v.literal("Satellite Station")
    ),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })),
  handler: async (ctx) => {
    return await ctx.db.query("applianceLocations").collect();
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
    stationLocation: v.union(
      v.literal("Main Station"),
      v.literal("Satellite Station")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
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

    // Check if user is admin or has Lieutenant rank or higher
    const rankOrder = {
      "Probationary": 1,
      "Firefighter": 2,
      "Lieutenant": 3,
      "Captain": 4
    };
    
    const userRank = user.rank;
    const hasRequiredRank = userRank && rankOrder[userRank] >= rankOrder["Lieutenant"];
    
    if (!user.isAdmin && !hasRequiredRank) {
      throw new Error("Not authorized to update appliance locations. Lieutenant rank or higher required.");
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
    stationLocation: v.union(
      v.literal("Main Station"),
      v.literal("Satellite Station")
    ),
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
