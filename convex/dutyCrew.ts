import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get all duty crews
export const getAllDutyCrews = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("dutyCrew"),
      _creationTime: v.number(),
      name: v.string(),
      number: v.number(),
      members: v.array(v.id("users")),
      leader: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const crews = await ctx.db.query("dutyCrew").collect();
    return crews.sort((a, b) => a.number - b.number);
  },
});

// Get a specific duty crew by ID
export const getDutyCrew = query({
  args: {
    id: v.id("dutyCrew"),
  },
  returns: v.object({
    _id: v.id("dutyCrew"),
    name: v.string(),
    number: v.number(),
    members: v.array(v.id("users")),
    leader: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const dutyCrew = await ctx.db.get(args.id);
    if (!dutyCrew) {
      throw new Error("Duty crew not found");
    }
    return dutyCrew;
  },
});

// Create a new duty crew
export const createDutyCrew = mutation({
  args: {
    name: v.string(),
    number: v.number(),
    members: v.array(v.id("users")),
    leader: v.optional(v.id("users")),
  },
  returns: v.id("dutyCrew"),
  handler: async (ctx, args): Promise<Id<"dutyCrew">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if a duty crew with the same number already exists
    const existingDutyCrew = await ctx.db
      .query("dutyCrew")
      .withIndex("by_number", (q) => q.eq("number", args.number))
      .first();

    if (existingDutyCrew) {
      throw new Error(`Duty crew ${args.number} already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("dutyCrew", {
      name: args.name,
      number: args.number,
      members: args.members,
      leader: args.leader,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update an existing duty crew
export const updateDutyCrew = mutation({
  args: {
    id: v.id("dutyCrew"),
    name: v.optional(v.string()),
    number: v.optional(v.number()),
    members: v.optional(v.array(v.id("users"))),
    leader: v.optional(v.id("users")),
  },
  returns: v.id("dutyCrew"),
  handler: async (ctx, args): Promise<Id<"dutyCrew">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const dutyCrew = await ctx.db.get(args.id);
    if (!dutyCrew) {
      throw new Error("Duty crew not found");
    }

    const updates: {
      name?: string;
      number?: number;
      members?: Id<"users">[];
      leader?: Id<"users"> | undefined;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }

    if (args.number !== undefined) {
      updates.number = args.number;
    }

    if (args.members !== undefined) {
      updates.members = args.members;
    }

    if (args.leader !== undefined) {
      updates.leader = args.leader === null ? undefined : args.leader;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

// Delete a duty crew
export const deleteDutyCrew = mutation({
  args: {
    id: v.id("dutyCrew"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if there are any schedules using this duty crew
    const schedules = await ctx.db
      .query("dutyCrewSchedule")
      .withIndex("by_dutyCrew", (q) => q.eq("dutyCrewId", args.id))
      .first();

    if (schedules) {
      throw new Error("Cannot delete duty crew that is used in schedules");
    }

    await ctx.db.delete(args.id);
    return true;
  },
});

// Helper function to get the nth Sunday of a month
function getNthSundayOfMonth(year: number, month: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstSunday = new Date(firstDay);
  firstSunday.setDate(firstDay.getDate() + (7 - firstDay.getDay()) % 7);

  // If n is 1 and the first day of the month is a Sunday, return the first day
  if (n === 1 && firstDay.getDay() === 0) {
    return firstDay;
  }

  // Otherwise, calculate the nth Sunday
  const nthSunday = new Date(firstSunday);
  nthSunday.setDate(firstSunday.getDate() + (n - 1) * 7);

  // If the calculated date is in the next month, return null
  if (nthSunday.getMonth() !== month) {
    return new Date(0); // Invalid date
  }

  return nthSunday;
}

// Get the duty crew assigned to a specific date
export const getDutyCrewForDate = query({
  args: {
    date: v.number(), // Timestamp for the date
  },
  returns: v.union(
    v.object({
      _id: v.id("dutyCrew"),
      name: v.string(),
      number: v.number(),
      members: v.array(v.id("users")),
      leader: v.optional(v.id("users")),
      isSpecial: v.boolean(),
      notes: v.optional(v.string()),
      date: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const date = new Date(args.date);

    // Check if there's a manual assignment for this date
    const schedule = await ctx.db
      .query("dutyCrewSchedule")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    if (schedule) {
      const dutyCrew = await ctx.db.get(schedule.dutyCrewId);
      if (dutyCrew) {
        return {
          ...dutyCrew,
          isSpecial: schedule.isSpecial,
          notes: schedule.notes,
          date: args.date,
        };
      }
    }

    // If no manual assignment, calculate based on the rule:
    // Duty Crew 1 - 1st Sunday, Duty Crew 2 - 2nd Sunday, etc.
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Calculate which Sunday of the month this is
    let sundayCount = 0;
    for (let i = 1; i <= day; i++) {
      const currentDay = new Date(year, month, i);
      if (currentDay.getDay() === 0) { // 0 is Sunday
        sundayCount++;
        if (i === day) {
          break;
        }
      }
    }

    // If it's not a Sunday or we couldn't determine which Sunday it is
    if (date.getDay() !== 0 || sundayCount === 0) {
      return null;
    }

    // For 5th Sunday, we consider it a special case (all duty crews)
    const isSpecial = sundayCount === 5;

    if (!isSpecial) {
      const dutyCrew = await ctx.db
        .query("dutyCrew")
        .withIndex("by_number", (q) => q.eq("number", sundayCount))
        .first();

      if (dutyCrew) {
        return {
          ...dutyCrew,
          isSpecial: false,
          notes: undefined,
          date: args.date,
        };
      }
    } else {
      // For 5th Sunday, use the first duty crew but mark it as special
      const allDutyCrews = await ctx.db.query("dutyCrew").collect();
      const allMembers = allDutyCrews.flatMap(crew => crew.members);
      const firstDutyCrew = allDutyCrews.find(crew => crew.number === 1);

      if (firstDutyCrew) {
        return {
          ...firstDutyCrew,
          name: "All Duty Crews",
          number: 0,
          members: allMembers,
          isSpecial: true,
          notes: "All duty crews",
          date: args.date,
        };
      }
    }

    return null;
  },
});

// Enriched member info for schedule display
const assignmentMemberValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  isLeader: v.boolean(),
});

type AssignmentMember = {
  _id: Id<"users">;
  name: string;
  firstName?: string;
  lastName?: string;
  isLeader: boolean;
};

// Resolve a crew's members to user info, using a shared cache so each user
// is only fetched once per query even when they appear in multiple crews.
async function resolveCrewMembers(
  ctx: QueryCtx,
  crew: Doc<"dutyCrew">,
  userCache: Map<Id<"users">, Doc<"users"> | null>
): Promise<AssignmentMember[]> {
  const members: AssignmentMember[] = [];
  for (const memberId of crew.members) {
    let user = userCache.get(memberId);
    if (user === undefined) {
      user = await ctx.db.get(memberId);
      userCache.set(memberId, user);
    }
    if (user) {
      members.push({
        _id: user._id,
        name: user.name || "",
        firstName: user.firstName,
        lastName: user.lastName,
        isLeader: crew.leader === user._id,
      });
    }
  }
  return members;
}

// Get upcoming duty crew assignments
export const getUpcomingDutyCrewAssignments = query({
  args: {
    count: v.optional(v.number()), // Number of upcoming assignments to return
  },
  returns: v.array(
    v.object({
      date: v.number(),
      dutyCrew: v.object({
        _id: v.id("dutyCrew"),
        name: v.string(),
        number: v.number(),
      }),
      isSpecial: v.boolean(),
      notes: v.optional(v.string()),
      // Present only for manual overrides (dutyCrewSchedule docs)
      scheduleId: v.optional(v.id("dutyCrewSchedule")),
      // Empty for special (all-crews) Sundays
      members: v.array(assignmentMemberValidator),
    })
  ),
  handler: async (ctx, args) => {
    const count = args.count ?? 4; // Default to 4 upcoming assignments
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = [];
    const allDutyCrews = await ctx.db.query("dutyCrew").collect();
    const userCache = new Map<Id<"users">, Doc<"users"> | null>();

    // Get all manual assignments in the future
    const manualAssignments = await ctx.db
      .query("dutyCrewSchedule")
      .withIndex("by_date", (q) => q.gte("date", today.getTime()))
      .order("asc")
      .take(count);

    // Add manual assignments to the result
    for (const assignment of manualAssignments) {
      const dutyCrew = await ctx.db.get(assignment.dutyCrewId);
      if (dutyCrew) {
        result.push({
          date: assignment.date,
          dutyCrew: {
            _id: dutyCrew._id,
            name: dutyCrew.name,
            number: dutyCrew.number,
          },
          isSpecial: assignment.isSpecial,
          notes: assignment.notes,
          scheduleId: assignment._id,
          members: assignment.isSpecial
            ? []
            : await resolveCrewMembers(ctx, dutyCrew, userCache),
        });
      }
    }

    // If we don't have enough manual assignments, calculate the upcoming Sundays
    if (result.length < count) {
      let currentDate = new Date(today);

      // Find the next Sunday
      const daysUntilNextSunday = (7 - currentDate.getDay()) % 7;
      currentDate.setDate(currentDate.getDate() + daysUntilNextSunday);

      while (result.length < count) {
        const timestamp = currentDate.getTime();

        // Check if we already have a manual assignment for this date
        const existingAssignment = result.find(a => a.date === timestamp);

        if (!existingAssignment) {
          const month = currentDate.getMonth();
          const year = currentDate.getFullYear();

          // Calculate which Sunday of the month this is
          let sundayCount = 0;
          for (let i = 1; i <= currentDate.getDate(); i++) {
            const checkDate = new Date(year, month, i);
            if (checkDate.getDay() === 0) { // 0 is Sunday
              sundayCount++;
            }
          }

          // For 5th Sunday, we consider it a special case (all duty crews)
          const isSpecial = sundayCount === 5;

          if (!isSpecial) {
            // For normal Sundays, get the corresponding duty crew
            const dutyCrewNumber = sundayCount;
            const dutyCrew = allDutyCrews.find(crew => crew.number === dutyCrewNumber);

            if (dutyCrew) {
              result.push({
                date: timestamp,
                dutyCrew: {
                  _id: dutyCrew._id,
                  name: dutyCrew.name,
                  number: dutyCrew.number,
                },
                isSpecial: false,
                notes: undefined,
                scheduleId: undefined,
                members: await resolveCrewMembers(ctx, dutyCrew, userCache),
              });
            }
          } else {
            // For 5th Sunday, use the first duty crew but mark it as special
            const firstDutyCrew = allDutyCrews.find(crew => crew.number === 1);
            if (firstDutyCrew) {
              result.push({
                date: timestamp,
                dutyCrew: {
                  _id: firstDutyCrew._id,
                  name: "All Duty Crews",
                  number: 0,
                },
                isSpecial: true,
                notes: "All duty crews",
                scheduleId: undefined,
                members: [],
              });
            }
          }
        }

        // Move to the next Sunday
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }

    // Sort by date
    result.sort((a, b) => a.date - b.date);

    return result.slice(0, count);
  },
});

// Create or update a manual duty crew assignment
export const assignDutyCrew = mutation({
  args: {
    date: v.number(), // Timestamp for the date
    dutyCrewId: v.id("dutyCrew"),
    isSpecial: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  returns: v.id("dutyCrewSchedule"),
  handler: async (ctx, args): Promise<Id<"dutyCrewSchedule">> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if the duty crew exists
    const dutyCrew = await ctx.db.get(args.dutyCrewId);
    if (!dutyCrew) {
      throw new Error("Duty crew not found");
    }

    // Check if there's already an assignment for this date
    const existingSchedule = await ctx.db
      .query("dutyCrewSchedule")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    const now = Date.now();

    if (existingSchedule) {
      // Update the existing assignment
      await ctx.db.patch(existingSchedule._id, {
        dutyCrewId: args.dutyCrewId,
        isSpecial: args.isSpecial ?? false,
        notes: args.notes,
        updatedAt: now,
      });
      return existingSchedule._id;
    } else {
      // Create a new assignment
      return await ctx.db.insert("dutyCrewSchedule", {
        date: args.date,
        dutyCrewId: args.dutyCrewId,
        isSpecial: args.isSpecial ?? false,
        notes: args.notes,
        createdBy: user._id,
        updatedAt: now,
      });
    }
  },
});

// Delete a manual duty crew assignment
export const deleteAssignment = mutation({
  args: {
    id: v.id("dutyCrewSchedule"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.db.delete(args.id);
    return true;
  },
});

// Check if the current authenticated user is a leader of the given duty crew
export const isCurrentUserDutyCrewLeader = query({
  args: {
    dutyCrewId: v.id("dutyCrew"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const dutyCrew = await ctx.db.get(args.dutyCrewId);
    if (!dutyCrew) return false;

    return dutyCrew.leader === userId;
  },
});
