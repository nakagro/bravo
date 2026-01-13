import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Helper to normalize a timestamp to midnight UTC of that day
// This ensures all records for the same calendar date use the same timestamp
function normalizeToMidnight(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

// Get deployment availability for a specific date range
export const getDeploymentAvailability = query({
  args: {
    startDate: v.number(), // Timestamp for start date
    endDate: v.number(),   // Timestamp for end date
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      userId: v.id("users"),
      date: v.number(),
      availability: v.object({
        notAvailable: v.boolean(),
        local: v.boolean(),
        shortHaul: v.boolean(),
        longHaul: v.boolean(),
      }),
      message: v.optional(v.string()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Get all deployment availability records within the date range
    const deploymentAvailability = await ctx.db
      .query("deploymentAvailability")
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();

    // Filter out fields not in the validator
    return deploymentAvailability.map(record => ({
      _id: record._id,
      userId: record.userId,
      date: record.date,
      availability: record.availability,
      updatedAt: record.updatedAt
    }));
  },
});

// Get current user's deployment availability for a specific date range
export const getCurrentUserDeploymentAvailability = query({
  args: {
    startDate: v.number(), // Timestamp for start date
    endDate: v.number(),   // Timestamp for end date
  },
  returns: v.array(
    v.object({
      _id: v.string(),
      date: v.number(),
      availability: v.object({
        notAvailable: v.boolean(),
        local: v.boolean(),
        shortHaul: v.boolean(),
        longHaul: v.boolean(),
      }),
      message: v.optional(v.string()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Get the authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return []; // Return empty array if not authenticated
    }

    // Get the user's deployment availability records within the date range
    const deploymentAvailability = await ctx.db
      .query("deploymentAvailability")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();

    // Filter out fields not in the validator
    return deploymentAvailability.map(record => ({
      _id: record._id,
      date: record.date,
      availability: record.availability,
      message: record.message || "",
      updatedAt: record.updatedAt
    }));
  },
});

// Update user's deployment availability for a specific date
export const updateDeploymentAvailability = mutation({
  args: {
    date: v.number(), // Timestamp for the date
    availability: v.object({
      notAvailable: v.boolean(),
      local: v.boolean(),
      shortHaul: v.boolean(),
      longHaul: v.boolean(),
    }),
    message: v.optional(v.string()), // Optional message for this date's availability
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Get the authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update your deployment availability");
    }

    // Normalize the date to midnight UTC to ensure consistent storage
    const normalizedDate = normalizeToMidnight(args.date);

    // Check if a record already exists for this user and date
    const existingRecord = await ctx.db
      .query("deploymentAvailability")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("date"), normalizedDate)
        )
      )
      .first();

    const now = Date.now();

    if (existingRecord) {
      // Update existing record
      await ctx.db.patch(existingRecord._id, {
        availability: args.availability,
        message: args.message,
        updatedAt: now,
      });
    } else {
      // Create new record
      await ctx.db.insert("deploymentAvailability", {
        userId,
        date: normalizedDate,
        availability: args.availability,
        message: args.message,
        updatedAt: now,
      });
    }

    return true;
  },
});

// Get all users' deployment availability aggregated by date
export const getAggregatedDeploymentAvailability = query({
  args: {
    startDate: v.number(), // Timestamp for start date
    endDate: v.number(),   // Timestamp for end date
  },
  returns: v.array(
    v.object({
      date: v.number(),
      counts: v.object({
        notAvailable: v.number(),
        local: v.number(),
        shortHaul: v.number(),
        longHaul: v.number(),
        total: v.number(),
      }),
      users: v.array(
        v.object({
          userId: v.id("users"),
          name: v.optional(v.string()),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
          availability: v.object({
            notAvailable: v.boolean(),
            local: v.boolean(),
            shortHaul: v.boolean(),
            longHaul: v.boolean(),
          }),
          message: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    // Get all deployment availability records within the date range
    const deploymentAvailability = await ctx.db
      .query("deploymentAvailability")
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();

    // Get all users
    const users = await ctx.db.query("users").collect();
    const usersMap = new Map(users.map(user => [user._id, user]));

    // Group records by date
    // Note: The frontend already sends dates normalized to midnight in the user's local timezone.
    // We use the stored date directly to avoid timezone mismatches from re-normalizing in UTC.
    const recordsByDate = new Map();

    for (const record of deploymentAvailability) {
      // Use the date as stored - it's already normalized to midnight in the user's local timezone
      const dateKey = record.date;

      if (!recordsByDate.has(dateKey)) {
        recordsByDate.set(dateKey, []);
      }
      recordsByDate.get(dateKey).push(record);
    }

    // Create aggregated results
    const results = [];

    for (const [date, records] of recordsByDate.entries()) {
      const counts = {
        notAvailable: 0,
        local: 0,
        shortHaul: 0,
        longHaul: 0,
        total: records.length,
      };

      const usersWithAvailability = [];

      for (const record of records) {
        const user = usersMap.get(record.userId);
        if (!user) continue;

        if (record.availability.notAvailable) counts.notAvailable++;
        if (record.availability.local) counts.local++;
        if (record.availability.shortHaul) counts.shortHaul++;
        if (record.availability.longHaul) counts.longHaul++;

        usersWithAvailability.push({
          userId: record.userId,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          availability: record.availability,
          message: record.message,
        });
      }

      results.push({
        date,
        counts,
        users: usersWithAvailability,
      });
    }

    // Sort results by date
    results.sort((a, b) => a.date - b.date);

    return results;
  },
});
