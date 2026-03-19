import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// Get all user statuses, resetting at 4am each day
export const getStatuses = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.string(),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      memberNumber: v.optional(v.string()),
      currentStatus: v.optional(
        v.union(
          v.literal("available - station"),
          v.literal("available - at station"),
          v.literal("available - satellite"),
          v.literal("not available"),
          v.literal("delayed response"),
          v.literal("WFH"),
          v.literal("WFH - at station")
        )
      ),
      statusUpdatedAt: v.optional(v.number()),
      statusExpiresAt: v.optional(v.number()),
      statusDurationHours: v.optional(v.number()),
      isBirthday: v.optional(v.boolean()),
      nextStatus: v.optional(v.union(
        v.literal("available - station"),
        v.literal("available - at station"),
        v.literal("available - satellite"),
        v.literal("not available"),
        v.literal("delayed response"),
        v.literal("WFH"),
        v.literal("WFH - at station"),
        v.literal("reset")
      )),
      nextStatusAt: v.optional(v.number()),
      isDutyOfficer: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx) => {
    // Calculate the timestamp for 4am of the current day
    const now = new Date();
    const today4am = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      4, // 4am
      0, // 0 minutes
      0, // 0 seconds
      0 // 0 milliseconds
    ).getTime();
    
    // If current time is before 4am, use 4am from the previous day
    const cutoffTime = now.getHours() < 4 ? 
      today4am - 24 * 60 * 60 * 1000 : // Subtract one day if before 4am
      today4am;
      
    const users = await ctx.db.query("users").collect();
    
    // Map users to the format we need, but reset status if it was updated before the cutoff time
    return users.map((user) => {
      // Check if the status was updated after the cutoff time
      const isStatusCurrent = user.statusUpdatedAt && user.statusUpdatedAt >= cutoffTime;
      
      // Check if status has expired (if it has an expiration time)
      const hasExpired = user.statusExpiresAt && user.statusExpiresAt <= now.getTime();
      
      // Status is valid if it's current AND not expired
      const isStatusValid = isStatusCurrent && !hasExpired;
      
      return {
        _id: user._id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        memberNumber: user.memberNumber,
        // Only include currentStatus if it was updated after the cutoff time and hasn't expired
        currentStatus: isStatusValid ? user.currentStatus : undefined,
        statusUpdatedAt: isStatusValid ? user.statusUpdatedAt : undefined,
        statusExpiresAt: isStatusValid ? user.statusExpiresAt : undefined,
        statusDurationHours: isStatusValid ? user.statusDurationHours : undefined,
        isBirthday: user.isBirthday,
        nextStatus: isStatusValid ? user.nextStatus : undefined,
        nextStatusAt: isStatusValid ? user.nextStatusAt : undefined,
        isDutyOfficer: user.isDutyOfficer,
      };
    });
  },
});

// Raw query returning users' status fields without any cutoff/reset logic.
export const getAllUsersStatus = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      memberNumber: v.optional(v.string()),
      currentStatus: v.optional(
        v.union(
          v.literal("available - station"),
          v.literal("available - at station"),
          v.literal("available - satellite"),
          v.literal("not available"),
          v.literal("delayed response"),
          v.literal("WFH"),
          v.literal("WFH - at station")
        )
      ),
      statusUpdatedAt: v.optional(v.number()),
      statusExpiresAt: v.optional(v.number()),
      statusDurationHours: v.optional(v.number()),
      isBirthday: v.optional(v.boolean()),
      nextStatus: v.optional(v.union(
        v.literal("available - station"),
        v.literal("available - at station"),
        v.literal("available - satellite"),
        v.literal("not available"),
        v.literal("delayed response"),
        v.literal("WFH"),
        v.literal("WFH - at station"),
        v.literal("reset")
      )),
      nextStatusAt: v.optional(v.number()),
      isDutyOfficer: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      memberNumber: u.memberNumber,
      currentStatus: u.currentStatus,
      statusUpdatedAt: u.statusUpdatedAt,
      statusExpiresAt: u.statusExpiresAt,
      statusDurationHours: u.statusDurationHours,
      isBirthday: u.isBirthday,
      nextStatus: u.nextStatus,
      nextStatusAt: u.nextStatusAt,
      isDutyOfficer: u.isDutyOfficer,
    }));
  },
});

// Get the current duty officer
export const getDutyOfficer = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.string(),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const dutyOfficer = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDutyOfficer"), true))
      .first();
    
    if (!dutyOfficer) {
      return null;
    }
    
    return {
      _id: dutyOfficer._id,
      name: dutyOfficer.name,
      firstName: dutyOfficer.firstName,
      lastName: dutyOfficer.lastName,
    };
  },
});

// Get current user's status
export const getCurrentUserStatus = query({
  args: {},
  returns: v.union(
    v.object({
      currentStatus: v.optional(
        v.union(
          v.literal("available - station"),
          v.literal("available - at station"),
          v.literal("available - satellite"),
          v.literal("not available"),
          v.literal("delayed response"),
          v.literal("WFH"),
          v.literal("WFH - at station")
        )
      ),
      statusUpdatedAt: v.optional(v.number()),
      statusExpiresAt: v.optional(v.number()),
      statusDurationHours: v.optional(v.number()),
      nextStatus: v.optional(v.union(
        v.literal("available - station"),
        v.literal("available - at station"),
        v.literal("available - satellite"),
        v.literal("not available"),
        v.literal("delayed response"),
        v.literal("WFH"),
        v.literal("WFH - at station"),
        v.literal("reset")
      )),
      nextStatusAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    // Get the authenticated user ID using the same pattern as other functions
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null; // Return null if not authenticated
    }
    
    // Get the current user data directly using the ID
    const user = await ctx.db.get(userId);
    
    if (!user) {
      return null; // Return null if user not found
    }
    
    // Check if status has expired
    const hasExpired = user.statusExpiresAt && user.statusExpiresAt <= Date.now();
    
    return {
      currentStatus: hasExpired ? undefined : user.currentStatus,
      statusUpdatedAt: hasExpired ? undefined : user.statusUpdatedAt,
      statusExpiresAt: hasExpired ? undefined : user.statusExpiresAt,
      statusDurationHours: hasExpired ? undefined : user.statusDurationHours,
      nextStatus: hasExpired ? undefined : user.nextStatus,
      nextStatusAt: hasExpired ? undefined : user.nextStatusAt,
    };
  },
});

// Update user status
export const updateUserStatus = mutation({
  args: {
    status: v.union(
      v.literal("available - station"),
      v.literal("available - at station"),
      v.literal("available - satellite"),
      v.literal("not available"),
      v.literal("delayed response"),
      v.literal("WFH"),
      v.literal("WFH - at station")
    ),
    durationHours: v.optional(v.number()), // Optional duration in hours
    nextStatus: v.optional(v.union(
      v.literal("available - station"),
      v.literal("available - at station"),
      v.literal("available - satellite"),
      v.literal("not available"),
      v.literal("delayed response"),
      v.literal("WFH"),
      v.literal("WFH - at station"),
      v.literal("reset")
    )), // Optional status to transition to after duration
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Get the authenticated user ID using the same pattern as other mutations
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update your status");
    }
    
    // Get the current user data directly using the ID
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Update the user's status
    const now = Date.now();
    const statusExpiresAt = args.durationHours ? now + (args.durationHours * 60 * 60 * 1000) : undefined;
    
    await ctx.db.patch(userId, {
      currentStatus: args.status,
      statusUpdatedAt: now,
      statusExpiresAt: statusExpiresAt,
      statusDurationHours: args.durationHours,
      nextStatus: args.nextStatus,
      nextStatusAt: args.nextStatus ? statusExpiresAt : undefined,
    });
    
    // Record status change in history
    await ctx.db.insert("memberStatusHistory", {
      userId: userId,
      status: args.status,
      timestamp: now,
    });
    
    return true;
  },
});

// Get current user ID
export const getCurrentUserId = query({
  args: {},
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx) => {
    return await getAuthUserId(ctx);
  },
});

// Check if current user is duty officer
export const isCurrentUserDutyOfficer = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }
    
    const user = await ctx.db.get(userId);
    return user?.isDutyOfficer ?? false;
  },
});

// Set duty officer
export const setDutyOfficer = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Get the authenticated user ID using the same pattern as other mutations
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("You must be signed in to set a duty officer");
    }
    
    // Find current duty officer if any
    const currentDutyOfficer = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isDutyOfficer"), true))
      .first();
    
    // If there is a current duty officer, update their record
    if (currentDutyOfficer) {
      await ctx.db.patch(currentDutyOfficer._id, {
        isDutyOfficer: false,
      });
      
      // Find the most recent duty officer history record for this user
      const dutyHistory = await ctx.db
        .query("dutyOfficerHistory")
        .filter((q) => q.eq(q.field("userId"), currentDutyOfficer._id))
        .order("desc")
        .first();
      
      // Update the end time if a record exists
      if (dutyHistory && !dutyHistory.endTimestamp) {
        await ctx.db.patch(dutyHistory._id, {
          endTimestamp: Date.now(),
        });
      }
    }
    
    // Set the new duty officer
    await ctx.db.patch(args.userId, {
      isDutyOfficer: true,
    });
    
    // Create a new duty officer history record
    await ctx.db.insert("dutyOfficerHistory", {
      userId: args.userId,
      startTimestamp: Date.now(),
    });
    
    return true;
  },
});

// Unset duty officer (remove duty officer status from current user)
export const unsetDutyOfficer = mutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    // Get the authenticated user ID
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("You must be signed in to unset duty officer");
    }
    
    // Get the current user
    const currentUser = await ctx.db.get(currentUserId);
    if (!currentUser) {
      throw new Error("User not found");
    }
    
    // Check if the current user is the duty officer
    if (!currentUser.isDutyOfficer) {
      throw new Error("You are not currently the duty officer");
    }
    
    // Remove duty officer status
    await ctx.db.patch(currentUserId, {
      isDutyOfficer: false,
    });
    
    // Find the most recent duty officer history record for this user
    const dutyHistory = await ctx.db
      .query("dutyOfficerHistory")
      .filter((q) => q.eq(q.field("userId"), currentUserId))
      .order("desc")
      .first();
    
    // Update the end time if a record exists
    if (dutyHistory && !dutyHistory.endTimestamp) {
      await ctx.db.patch(dutyHistory._id, {
        endTimestamp: Date.now(),
      });
    }
    
    return true;
  },
});

// Get all users with Officer skill
export const getUsersWithOfficerSkill = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      memberNumber: v.optional(v.string()),
      isDutyOfficer: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx) => {
    // Get the authenticated user ID
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      return [];
    }
    
    // Find the Officer skill
    const officerSkill = await ctx.db
      .query("skills")
      .filter((q) => q.eq(q.field("code"), "OF"))
      .first();
    
    if (!officerSkill) {
      return [];
    }
    
    // Get all users
    const allUsers = await ctx.db.query("users").collect();
    
    // Filter users who have the Officer skill
    const usersWithOfficerSkill = allUsers.filter((user) => {
      const userSkills = user.skills || [];
      return userSkills.includes(officerSkill._id);
    });
    
    // Return only necessary fields
    return usersWithOfficerSkill.map((user) => ({
      _id: user._id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      memberNumber: user.memberNumber,
      isDutyOfficer: user.isDutyOfficer,
    }));
  },
});

// Clear a user's status (internal helper)
export const clearStatus = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      currentStatus: undefined,
      statusUpdatedAt: undefined,
      statusExpiresAt: undefined,
      statusDurationHours: undefined,
      nextStatus: undefined,
      nextStatusAt: undefined,
    });
    return null;
  },
});

// Process automatic status transitions (called by cron)
export const processStatusTransitions = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let transitionsProcessed = 0;
    
    // Find all users with pending status transitions
    const users = await ctx.db.query("users").collect();
    
    for (const user of users) {
      if (user.nextStatusAt && user.nextStatusAt <= now && user.nextStatus) {
        // Time to transition to next status
        const previousStatus = user.currentStatus;
        
        if (user.nextStatus === "reset") {
          // Special case: reset means clear the status
          await ctx.db.patch(user._id, {
            currentStatus: undefined,
            statusUpdatedAt: undefined,
            statusExpiresAt: undefined,
            statusDurationHours: undefined,
            nextStatus: undefined,
            nextStatusAt: undefined,
          });
          
          // Send notification about status reset
          await ctx.scheduler.runAfter(0, api.pushNotificationAction.sendNotification, {
            title: "Status Updated",
            body: `Your status has been reset from "${previousStatus}" as scheduled.`,
            userId: user._id,
          });
        } else {
          // Transition to the specified next status
          await ctx.db.patch(user._id, {
            currentStatus: user.nextStatus,
            statusUpdatedAt: now,
            statusExpiresAt: undefined, // Clear expiration since this is the final status
            statusDurationHours: undefined,
            nextStatus: undefined,
            nextStatusAt: undefined,
          });
          
          // Record the transition in history
          await ctx.db.insert("memberStatusHistory", {
            userId: user._id,
            status: user.nextStatus,
            timestamp: now,
          });
          
          // Send notification about status change
          await ctx.scheduler.runAfter(0, api.pushNotificationAction.sendNotification, {
            title: "Status Updated",
            body: `Your status has changed from "${previousStatus}" to "${user.nextStatus}" as scheduled.`,
            userId: user._id,
          });
        }
        
        transitionsProcessed++;
      }
    }
    
    return transitionsProcessed;
  },
});

// Get main status options (for setting current status)
export const getMainStatusOptions = query({
  args: {},
  returns: v.array(v.object({
    value: v.string(),
    label: v.string(),
    shortLabel: v.string(),
    icon: v.string(),
    backgroundColorClass: v.string(),
    textColorClass: v.string(),
    buttonColorClass: v.string(),
    buttonHoverColorClass: v.string(),
    buttonActiveColorClass: v.string(),
    buttonBorderColorClass: v.string(),
  })),
  handler: async () => {
    return [
      { 
        value: 'available - station', 
        label: 'Available - Station',
        shortLabel: 'Available - Station',
        icon: 'M5 13l4 4L19 7',
        backgroundColorClass: 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 dark:border-green-600',
        textColorClass: 'text-green-800 dark:text-green-300',
        buttonColorClass: 'text-green-700 dark:text-green-400',
        buttonHoverColorClass: 'hover:bg-green-50 dark:hover:bg-green-900/20',
        buttonActiveColorClass: 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600',
        buttonBorderColorClass: 'border-green-300 dark:border-green-800/50',
      },
      { 
        value: 'available - satellite', 
        label: 'Available - Satellite',
        shortLabel: 'Available - Satellite',
        icon: 'M5 13l4 4L19 7',
        backgroundColorClass: 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-400 dark:border-green-500',
        textColorClass: 'text-green-700 dark:text-green-400',
        buttonColorClass: 'text-green-700 dark:text-green-400',
        buttonHoverColorClass: 'hover:bg-green-50 dark:hover:bg-green-900/20',
        buttonActiveColorClass: 'bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-500',
        buttonBorderColorClass: 'border-green-300 dark:border-green-800/50',
      },
      { 
        value: 'delayed response', 
        label: 'Delayed',
        shortLabel: 'Delayed',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        backgroundColorClass: 'bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 dark:border-yellow-600',
        textColorClass: 'text-yellow-800 dark:text-yellow-300',
        buttonColorClass: 'text-yellow-700 dark:text-yellow-400',
        buttonHoverColorClass: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
        buttonActiveColorClass: 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 dark:border-yellow-600',
        buttonBorderColorClass: 'border-yellow-300 dark:border-yellow-800/50',
      },
      { 
        value: 'WFH', 
        label: 'Working From Home',
        shortLabel: 'WFH',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
        backgroundColorClass: 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-600',
        textColorClass: 'text-blue-800 dark:text-blue-300',
        buttonColorClass: 'text-blue-700 dark:text-blue-400',
        buttonHoverColorClass: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
        buttonActiveColorClass: 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-600',
        buttonBorderColorClass: 'border-blue-300 dark:border-blue-800/50',
      },
      { 
        value: 'not available', 
        label: 'Unavailable',
        shortLabel: 'Unavailable',
        icon: 'M6 18L18 6M6 6l12 12',
        backgroundColorClass: 'bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400 dark:border-gray-600',
        textColorClass: 'text-gray-800 dark:text-gray-300',
        buttonColorClass: 'text-gray-700 dark:text-gray-400',
        buttonHoverColorClass: 'hover:bg-gray-100 dark:hover:bg-gray-700/50',
        buttonActiveColorClass: 'bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-500 dark:border-gray-600',
        buttonBorderColorClass: 'border-gray-300 dark:border-gray-600/50',
      },
    ];
  },
});

// Get available status options for next status selection (includes reset)
export const getAvailableStatusOptions = query({
  args: {},
  returns: v.array(v.object({
    value: v.string(),
    label: v.string(),
    color: v.string(),
  })),
  handler: async () => {
    // Return the available status options with their display info
    return [
      { 
        value: 'available - station', 
        label: 'Available - Station', 
        color: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
      },
      { 
        value: 'available - satellite', 
        label: 'Available - Satellite', 
        color: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
      },
      { 
        value: 'delayed response', 
        label: 'Delayed', 
        color: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' 
      },
      { 
        value: 'WFH', 
        label: 'WFH', 
        color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
      },
      { 
        value: 'not available', 
        label: 'Unavailable', 
        color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' 
      },
      { 
        value: 'reset', 
        label: 'Clear Status', 
        color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' 
      },
    ];
  },
});

// Combined query to fetch all user info needed for YouTab in a single call
// This reduces query overhead from 4 separate queries to 1
export const getUserInfoForYouTab = query({
  args: {},
  returns: v.union(
    v.object({
      userId: v.id("users"),
      hasOfficerSkill: v.boolean(),
      isCurrentUserDutyOfficer: v.boolean(),
      currentStatus: v.optional(
        v.union(
          v.literal("available - station"),
          v.literal("available - at station"),
          v.literal("available - satellite"),
          v.literal("not available"),
          v.literal("delayed response"),
          v.literal("WFH"),
          v.literal("WFH - at station")
        )
      ),
      statusUpdatedAt: v.optional(v.number()),
      statusExpiresAt: v.optional(v.number()),
      statusDurationHours: v.optional(v.number()),
      nextStatus: v.optional(v.union(
        v.literal("available - station"),
        v.literal("available - at station"),
        v.literal("available - satellite"),
        v.literal("not available"),
        v.literal("delayed response"),
        v.literal("WFH"),
        v.literal("WFH - at station"),
        v.literal("reset")
      )),
      nextStatusAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    
    // Check if user has Officer skill
    // Skills are stored as an array of skill IDs on the user object
    let hasOfficerSkill = false;
    if (user.skills && user.skills.length > 0) {
      const skills = await Promise.all(
        user.skills.map(async (skillId) => {
          const skill = await ctx.db.get(skillId);
          return skill;
        })
      );
      hasOfficerSkill = skills.some(skill => skill?.code === "OF");
    }
    
    // Check if status has expired
    const hasExpired = user.statusExpiresAt && user.statusExpiresAt <= Date.now();
    
    return {
      userId: userId,
      hasOfficerSkill,
      isCurrentUserDutyOfficer: user.isDutyOfficer ?? false,
      currentStatus: hasExpired ? undefined : user.currentStatus,
      statusUpdatedAt: hasExpired ? undefined : user.statusUpdatedAt,
      statusExpiresAt: hasExpired ? undefined : user.statusExpiresAt,
      statusDurationHours: hasExpired ? undefined : user.statusDurationHours,
      nextStatus: hasExpired ? undefined : user.nextStatus,
      nextStatusAt: hasExpired ? undefined : user.nextStatusAt,
    };
  },
});

// Get users with scheduled status changes (for admin monitoring)
export const getUsersWithScheduledChanges = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      memberNumber: v.optional(v.string()),
      currentStatus: v.optional(
        v.union(
          v.literal("available - station"),
          v.literal("available - at station"),
          v.literal("available - satellite"),
          v.literal("not available"),
          v.literal("delayed response"),
          v.literal("WFH"),
          v.literal("WFH - at station")
        )
      ),
      statusUpdatedAt: v.optional(v.number()),
      statusExpiresAt: v.number(),
      statusDurationHours: v.number(),
      nextStatus: v.union(
        v.literal("available - station"),
        v.literal("available - at station"),
        v.literal("available - satellite"),
        v.literal("not available"),
        v.literal("delayed response"),
        v.literal("WFH"),
        v.literal("WFH - at station"),
        v.literal("reset")
      ),
      nextStatusAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const now = Date.now();
    
    // Get all users
    const users = await ctx.db.query("users").collect();
    
    // Filter users who have scheduled status changes (statusExpiresAt and nextStatus are set)
    const usersWithScheduledChanges = users.filter(user => 
      user.statusExpiresAt && 
      user.nextStatus && 
      user.nextStatusAt &&
      user.statusExpiresAt > now // Only show future changes
    );
    
    // Map to return format
    return usersWithScheduledChanges.map(user => ({
      _id: user._id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      memberNumber: user.memberNumber,
      currentStatus: user.currentStatus,
      statusUpdatedAt: user.statusUpdatedAt,
      statusExpiresAt: user.statusExpiresAt!,
      statusDurationHours: user.statusDurationHours!,
      nextStatus: user.nextStatus!,
      nextStatusAt: user.nextStatusAt!,
    }));
  },
});
