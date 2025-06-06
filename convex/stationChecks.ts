import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Get all station checks
export const getAllStationChecks = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("stationChecks"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      order: v.number(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const includeInactive = args.includeInactive ?? false;
    
    let query = ctx.db.query("stationChecks");
    
    if (!includeInactive) {
      query = query.filter((q) => q.eq(q.field("isActive"), true));
    }
    
    return await query.order("asc").collect();
  },
});

// Get a specific station check by ID
export const getStationCheck = query({
  args: {
    id: v.id("stationChecks"),
  },
  returns: v.object({
    _id: v.id("stationChecks"),
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    order: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const check = await ctx.db.get(args.id);
    if (!check) {
      throw new Error("Station check not found");
    }
    return check;
  },
});

// Create a new station check
export const createStationCheck = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    order: v.optional(v.number()),
  },
  returns: v.id("stationChecks"),
  handler: async (ctx, args): Promise<Id<"stationChecks">> => {
    // Get the current user ID using the auth system
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Get the current user from the database
    const currentUser = await ctx.db.get(userId);
    if (!currentUser) {
      throw new Error("User not found");
    }
    
    // If order is not provided, get the highest order and add 10
    let order = args.order;
    if (order === undefined) {
      const checks = await ctx.db
        .query("stationChecks")
        .order("desc")
        .first();
      
      order = checks ? checks.order + 10 : 10;
    }
    
    const now = Date.now();
    return await ctx.db.insert("stationChecks", {
      name: args.name,
      description: args.description,
      isActive: args.isActive,
      order,
      // Use the current user ID
      createdBy: currentUser._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update an existing station check
export const updateStationCheck = mutation({
  args: {
    id: v.id("stationChecks"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  returns: v.id("stationChecks"),
  handler: async (ctx, args): Promise<Id<"stationChecks">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    const check = await ctx.db.get(args.id);
    if (!check) {
      throw new Error("Station check not found");
    }
    
    const updates: {
      name?: string;
      description?: string | undefined;
      isActive?: boolean;
      order?: number;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };
    
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    
    if (args.description !== undefined) {
      updates.description = args.description;
    }
    
    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
    }
    
    if (args.order !== undefined) {
      updates.order = args.order;
    }
    
    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

// Delete a station check
export const deleteStationCheck = mutation({
  args: {
    id: v.id("stationChecks"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Check if there are any submissions using this check
    const submissions = await ctx.db
      .query("stationCheckSubmissions")
      .collect();
    
    const isUsed = submissions.some(submission => 
      submission.checkItems.some(item => item.checkId === args.id)
    );
    
    if (isUsed) {
      // Instead of deleting, mark as inactive
      await ctx.db.patch(args.id, {
        isActive: false,
        updatedAt: Date.now(),
      });
      return false;
    }
    
    await ctx.db.delete(args.id);
    return true;
  },
});

// Get the station check status for a specific week for a duty crew
export const getCurrentWeekCheckStatus = query({
  args: {
    dutyCrewId: v.optional(v.id("dutyCrew")),
    date: v.optional(v.number()), // Optional timestamp to specify a different week
  },
  returns: v.union(
    v.object({
      submission: v.object({
        _id: v.id("stationCheckSubmissions"),
        _creationTime: v.number(),
        date: v.number(),
        dutyCrewId: v.id("dutyCrew"),
        completedBy: v.id("users"),
        completedAt: v.number(),
        status: v.union(v.literal("draft"), v.literal("completed")),
        lastUpdatedBy: v.optional(v.id("users")),
        lastUpdatedAt: v.optional(v.number()),
        checkItems: v.array(
          v.object({
            checkId: v.id("stationChecks"),
            name: v.string(),
            isCompleted: v.boolean(),
            notes: v.optional(v.string()),
            completedBy: v.optional(v.id("users")),
            completedAt: v.optional(v.number()),
          })
        ),
        notes: v.optional(v.string()),
      }),
      dutyCrew: v.object({
        _id: v.id("dutyCrew"),
        name: v.string(),
        number: v.number(),
      }),
      completedBy: v.object({
        _id: v.id("users"),
        name: v.string(),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
      }),
      lastUpdatedBy: v.optional(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Use the provided date or default to current date
    const baseDate = args.date ? new Date(args.date) : new Date();
    baseDate.setHours(0, 0, 0, 0);
    
    // Calculate the week's boundaries (Monday to Sunday) for the given date
    const calculateWeekBoundaries = (date: Date) => {
      const currentDay = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Find the week's Sunday (end of week)
      const weekSunday = new Date(date);
      const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
      weekSunday.setDate(date.getDate() + daysUntilSunday);
      
      // Find the week's Monday (start of week)
      const weekMonday = new Date(date);
      const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
      weekMonday.setDate(date.getDate() - daysSinceMonday);
      
      return {
        sunday: weekSunday,
        monday: weekMonday
      };
    };
    
    const { sunday: currentWeekSunday, monday: currentWeekMonday } = calculateWeekBoundaries(baseDate);
    const sundayTimestamp = currentWeekSunday.getTime();
    
    // If dutyCrewId is provided, use it; otherwise, find the duty crew for the current week's Sunday
    let dutyCrewId = args.dutyCrewId;
    
    if (!dutyCrewId) {
      // Check if there's a manual assignment for this date
      const schedule = await ctx.db
        .query("dutyCrewSchedule")
        .filter((q) => q.eq(q.field("date"), sundayTimestamp))
        .first();
      
      if (schedule) {
        dutyCrewId = schedule.dutyCrewId;
      } else {
        // If no manual assignment, calculate based on the rule:
        // Duty Crew 1 - 1st Sunday, Duty Crew 2 - 2nd Sunday, etc.
        const month = currentWeekSunday.getMonth();
        const year = currentWeekSunday.getFullYear();
        
        // Calculate which Sunday of the month this is
        let sundayCount = 0;
        for (let i = 1; i <= currentWeekSunday.getDate(); i++) {
          const checkDate = new Date(year, month, i);
          if (checkDate.getDay() === 0) { // 0 is Sunday
            sundayCount++;
          }
        }
        
        // For 5th Sunday, we consider it a special case (all duty crews)
        const isSpecial = sundayCount === 5;
        
        // Determine the duty crew based on which Sunday of the month
        if (!isSpecial) {
          // For normal Sundays, get the corresponding duty crew
          const dutyCrewNumber = sundayCount;
          const dutyCrew = await ctx.db
            .query("dutyCrew")
            .filter((q) => q.eq(q.field("number"), dutyCrewNumber))
            .first();
          
          if (dutyCrew) {
            dutyCrewId = dutyCrew._id;
          }
        } else {
          // For 5th Sunday, get all duty crews (for now, just use the first one)
          const firstDutyCrew = await ctx.db
            .query("dutyCrew")
            .filter((q) => q.eq(q.field("number"), 1))
            .first();
          
          if (firstDutyCrew) {
            dutyCrewId = firstDutyCrew._id;
          }
        }
      }
    }
    
    if (!dutyCrewId) {
      return null;
    }
    
    // Find an existing submission for this week and duty crew
    // We'll look for both draft and completed submissions
    // We'll also look for submissions created anytime during the current week
    const mondayTimestamp = currentWeekMonday.getTime();
    
    // First, try to find a submission specifically for this Sunday
    let submission = await ctx.db
      .query("stationCheckSubmissions")
      .filter((q) => 
        q.and(
          q.eq(q.field("date"), sundayTimestamp),
          q.eq(q.field("dutyCrewId"), dutyCrewId)
        )
      )
      .order("desc") // Get the most recent one first
      .first();
    
    // If no submission is found for this Sunday specifically,
    // look for any submission created during the current week
    if (!submission) {
      submission = await ctx.db
        .query("stationCheckSubmissions")
        .filter((q) => 
          q.and(
            q.eq(q.field("dutyCrewId"), dutyCrewId),
            q.gte(q.field("_creationTime"), mondayTimestamp),
            q.lte(q.field("_creationTime"), sundayTimestamp + 24 * 60 * 60 * 1000) // Include all of Sunday
          )
        )
        .order("desc") // Get the most recent one first
        .first();
    }
    
    if (!submission) {
      return null;
    }
    
    // Get the duty crew information
    const dutyCrew = await ctx.db.get(dutyCrewId);
    if (!dutyCrew) {
      return null;
    }
    
    // Get the user who completed the submission
    const user = await ctx.db.get(submission.completedBy);
    if (!user) {
      return null;
    }
    
    // Get the user who last updated the submission (if applicable)
    let lastUpdatedByUser = null;
    if (submission.lastUpdatedBy) {
      lastUpdatedByUser = await ctx.db.get(submission.lastUpdatedBy);
    }
    
    // Properly format the response to match the validator types
    return {
      submission,
      dutyCrew: {
        _id: dutyCrew._id,
        name: dutyCrew.name,
        number: dutyCrew.number,
      },
      completedBy: {
        _id: user._id,
        name: user.name || "",
        firstName: user.firstName,
        lastName: user.lastName,
      },
      lastUpdatedBy: lastUpdatedByUser ? {
        _id: lastUpdatedByUser._id,
        name: lastUpdatedByUser.name || "",
        firstName: lastUpdatedByUser.firstName,
        lastName: lastUpdatedByUser.lastName,
      } : undefined,
    };
  },
});

import { getAuthUserId } from "@convex-dev/auth/server";

// Save a draft station check (in-progress)  
export const saveDraftStationCheck = mutation({
  args: {
    date: v.number(), // Timestamp for the date of submission
    dutyCrewId: v.id("dutyCrew"),
    checkItems: v.array(
      v.object({
        checkId: v.id("stationChecks"),
        name: v.string(),
        isCompleted: v.boolean(),
        notes: v.optional(v.string()),
        completedBy: v.optional(v.id("users")),
        completedAt: v.optional(v.number()),
      })
    ),
    notes: v.optional(v.string()),
    existingSubmissionId: v.optional(v.id("stationCheckSubmissions")),
  },
  returns: v.id("stationCheckSubmissions"),
  handler: async (ctx, args): Promise<Id<"stationCheckSubmissions">> => {
    // Get the current user ID using the auth system
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Get the current user from the database
    const currentUser = await ctx.db.get(userId);
    if (!currentUser) {
      throw new Error("User not found");
    }
    
    const now = Date.now();
    
    if (args.existingSubmissionId) {
      // Update the existing draft submission
      await ctx.db.patch(args.existingSubmissionId, {
        checkItems: args.checkItems,
        notes: args.notes,
        lastUpdatedBy: currentUser._id,
        lastUpdatedAt: now,
      });
      
      return args.existingSubmissionId;
    } else {
      // Check if there's already a submission for this date and duty crew
      const existingSubmission = await ctx.db
        .query("stationCheckSubmissions")
        .filter((q) => 
          q.and(
            q.eq(q.field("date"), args.date),
            q.eq(q.field("dutyCrewId"), args.dutyCrewId)
          )
        )
        .first();
        
      if (existingSubmission) {
        // Update the existing submission
        await ctx.db.patch(existingSubmission._id, {
          checkItems: args.checkItems,
          notes: args.notes,
          lastUpdatedBy: currentUser._id,
          lastUpdatedAt: now,
        });
        
        return existingSubmission._id;
      } else {
        // Create a new draft submission
        return await ctx.db.insert("stationCheckSubmissions", {
          date: args.date,
          dutyCrewId: args.dutyCrewId,
          checkItems: args.checkItems,
          notes: args.notes,
          completedBy: currentUser._id,
          completedAt: now,
          status: "draft",
          lastUpdatedBy: currentUser._id,
          lastUpdatedAt: now,
        });
      }
    }
  },
});

// Submit a completed station check
export const submitStationCheck = mutation({
  args: {
    date: v.number(), // Timestamp for the date of submission
    dutyCrewId: v.id("dutyCrew"),
    checkItems: v.array(
      v.object({
        checkId: v.id("stationChecks"),
        name: v.string(),
        isCompleted: v.boolean(),
        notes: v.optional(v.string()),
        completedBy: v.optional(v.id("users")),
        completedAt: v.optional(v.number()),
      })
    ),
    notes: v.optional(v.string()),
    existingSubmissionId: v.optional(v.id("stationCheckSubmissions")),
  },
  returns: v.id("stationCheckSubmissions"),
  handler: async (ctx, args): Promise<Id<"stationCheckSubmissions">> => {
    // Get the current user ID using the auth system
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Get the current user from the database
    const currentUser = await ctx.db.get(userId);
    if (!currentUser) {
      throw new Error("User not found");
    }
    
    // Validate that all check items are completed
    const incompleteItems = args.checkItems.filter(item => !item.isCompleted);
    if (incompleteItems.length > 0) {
      const incompleteNames = incompleteItems.map(item => item.name).join(", ");
      throw new Error(`Cannot complete station check: The following items are not completed: ${incompleteNames}`);
    }
    
    const now = Date.now();
    
    if (args.existingSubmissionId) {
      // Update the existing submission and mark as completed
      await ctx.db.patch(args.existingSubmissionId, {
        checkItems: args.checkItems,
        notes: args.notes,
        completedBy: currentUser._id,
        completedAt: now,
        status: "completed",
        lastUpdatedBy: currentUser._id,
        lastUpdatedAt: now,
      });
      
      return args.existingSubmissionId;
    } else {
      // Check if there's already a submission for this date and duty crew
      const existingSubmission = await ctx.db
        .query("stationCheckSubmissions")
        .filter((q) => 
          q.and(
            q.eq(q.field("date"), args.date),
            q.eq(q.field("dutyCrewId"), args.dutyCrewId)
          )
        )
        .first();
      
      if (existingSubmission) {
        // Update the existing submission and mark as completed
        await ctx.db.patch(existingSubmission._id, {
          checkItems: args.checkItems,
          notes: args.notes,
          completedBy: currentUser._id,
          completedAt: now,
          status: "completed",
          lastUpdatedBy: currentUser._id,
          lastUpdatedAt: now,
        });
        
        return existingSubmission._id;
      } else {
        // Create a new completed submission
        return await ctx.db.insert("stationCheckSubmissions", {
          date: args.date,
          dutyCrewId: args.dutyCrewId,
          checkItems: args.checkItems,
          notes: args.notes,
          completedBy: currentUser._id,
          completedAt: now,
          status: "completed",
          lastUpdatedBy: currentUser._id,
          lastUpdatedAt: now,
        });
      }
    }
  },
});

// Reopen a completed station check (change status from completed to draft)
export const reopenStationCheck = mutation({
  args: {
    submissionId: v.id("stationCheckSubmissions"),
  },
  returns: v.id("stationCheckSubmissions"),
  handler: async (ctx, args): Promise<Id<"stationCheckSubmissions">> => {
    // Get the current user ID using the auth system
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Get the current user from the database
    const currentUser = await ctx.db.get(userId);
    if (!currentUser) {
      throw new Error("User not found");
    }
    
    // Get the submission
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Station check submission not found");
    }
    
    // Check if the submission is already in draft status
    if (submission.status === "draft") {
      throw new Error("Station check is already in draft status");
    }
    
    const now = Date.now();
    
    // Update the submission status to draft
    await ctx.db.patch(args.submissionId, {
      status: "draft",
      lastUpdatedBy: currentUser._id,
      lastUpdatedAt: now,
    });
    
    return args.submissionId;
  },
});

// Get station check history for a specific duty crew
export const getStationCheckHistory = query({
  args: {
    dutyCrewId: v.id("dutyCrew"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("stationCheckSubmissions"),
      date: v.number(),
      completedBy: v.object({
        _id: v.id("users"),
        name: v.string(),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
      }),
      completedAt: v.number(),
      checkItems: v.array(
        v.object({
          checkId: v.id("stationChecks"),
          name: v.string(),
          isCompleted: v.boolean(),
          notes: v.optional(v.string()),
        })
      ),
      notes: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    
    const submissions = await ctx.db
      .query("stationCheckSubmissions")
      .filter((q) => q.eq(q.field("dutyCrewId"), args.dutyCrewId))
      .order("desc")
      .take(limit);
    
    // Fetch user details for each submission
    const results = [];
    
    for (const submission of submissions) {
      const user = await ctx.db.get(submission.completedBy);
      
      if (user) {
        results.push({
          ...submission,
          completedBy: {
            _id: user._id,
            name: user.name || "",
            firstName: user.firstName,
            lastName: user.lastName,
          },
        });
      }
    }
    
    return results;
  },
});
