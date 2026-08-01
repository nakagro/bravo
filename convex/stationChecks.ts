import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { notifyEvent } from "./lib/notifyEvent";

type SubmissionCheckItem = {
  checkId?: Id<"stationChecks">;
  name: string;
  area?: string;
  isPriority?: boolean;
  isCompleted: boolean;
  isNotApplicable?: boolean;
  notes?: string;
  completedBy?: Id<"users">;
  completedAt?: number;
  isAdHoc?: boolean;
  addedBy?: Id<"users">;
};

// An item counts toward submission when it is either completed or marked N/A
const isResolved = (item: { isCompleted: boolean; isNotApplicable?: boolean }) =>
  item.isCompleted || item.isNotApplicable === true;

// Reusable validator for a single submission check item
const checkItemValidator = v.object({
  checkId: v.optional(v.id("stationChecks")),
  name: v.string(),
  area: v.optional(v.string()),
  isPriority: v.optional(v.boolean()),
  isCompleted: v.boolean(),
  isNotApplicable: v.optional(v.boolean()),
  notes: v.optional(v.string()),
  completedBy: v.optional(v.id("users")),
  completedAt: v.optional(v.number()),
  isAdHoc: v.optional(v.boolean()),
  addedBy: v.optional(v.id("users")),
});

// Stamp per-item completedBy/completedAt server-side. Attribution set when an
// item is newly resolved (completed or marked N/A), preserved when it was
// already resolved the same way in the existing submission, and cleared when
// unresolved. Completed and N/A are mutually exclusive — completed wins if a
// client ever sends both. Ad-hoc items (no checkId) match by name.
function applyItemAttribution(
  incoming: SubmissionCheckItem[],
  existing: SubmissionCheckItem[] | undefined,
  userId: Id<"users">,
  now: number
): SubmissionCheckItem[] {
  return incoming.map((raw) => {
    const item = raw.isCompleted ? { ...raw, isNotApplicable: undefined } : raw;
    if (!isResolved(item)) {
      return { ...item, completedBy: undefined, completedAt: undefined };
    }
    const prev = existing?.find((e) =>
      item.checkId ? e.checkId === item.checkId : !e.checkId && e.name === item.name
    );
    const sameResolution =
      prev &&
      prev.isCompleted === item.isCompleted &&
      (prev.isNotApplicable === true) === (item.isNotApplicable === true);
    if (sameResolution && prev.completedBy) {
      return {
        ...item,
        completedBy: prev.completedBy,
        completedAt: prev.completedAt ?? now,
      };
    }
    return { ...item, completedBy: userId, completedAt: now };
  });
}

// Condition key for "the week's station checks were submitted". Officers map it
// to themselves in Duty Crew → Admin → Notifications.
export const CHECKS_SUBMITTED_KEY = "dutyCrew:checksSubmitted";

// Build the notice a duty-crew submission raises. The point of the whole thing
// is the exception detail: pen-and-paper sheets told nobody what was skipped or
// what needed a second look, so N/A items and anything with a note are named.
function buildSubmissionNotice(
  items: SubmissionCheckItem[],
  crewName: string,
  weekEnding: number
) {
  const completed = items.filter((i) => i.isCompleted).length;
  const notApplicable = items.filter((i) => !i.isCompleted && i.isNotApplicable === true);
  const withNotes = items.filter((i) => i.notes && i.notes.trim().length > 0);

  const weekLabel = new Date(weekEnding).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });

  const summary = [
    `${completed} completed`,
    notApplicable.length > 0 ? `${notApplicable.length} N/A` : null,
    withNotes.length > 0 ? `${withNotes.length} with notes` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const attention = [
    ...notApplicable.map(
      (i) => `${i.name} — marked N/A${i.notes ? `: ${i.notes.trim()}` : ""}`
    ),
    ...withNotes
      .filter((i) => i.isNotApplicable !== true)
      .map((i) => `${i.name} — ${i.notes!.trim()}`),
  ];

  return {
    weekLabel,
    summary,
    attention,
    description: `${crewName} · week ending Sun ${weekLabel} · ${summary}`,
  };
}

// Get all station checks, sorted by display order
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
      area: v.optional(v.string()),
      isPriority: v.optional(v.boolean()),
      isActive: v.boolean(),
      order: v.number(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const includeInactive = args.includeInactive ?? false;

    const checks = includeInactive
      ? await ctx.db.query("stationChecks").collect()
      : await ctx.db
          .query("stationChecks")
          .withIndex("by_isActive", (q) => q.eq("isActive", true))
          .collect();

    return checks.sort((a, b) => a.order - b.order);
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
    area: v.optional(v.string()),
    isPriority: v.optional(v.boolean()),
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
    return {
      _id: check._id,
      name: check.name,
      description: check.description,
      area: check.area,
      isPriority: check.isPriority,
      isActive: check.isActive,
      order: check.order,
      createdBy: check.createdBy,
      createdAt: check.createdAt,
      updatedAt: check.updatedAt,
    };
  },
});

// Create a new station check
export const createStationCheck = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    area: v.optional(v.string()),
    isPriority: v.optional(v.boolean()),
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
      const highest = await ctx.db
        .query("stationChecks")
        .withIndex("by_order")
        .order("desc")
        .first();

      order = highest ? highest.order + 10 : 10;
    }

    const now = Date.now();
    return await ctx.db.insert("stationChecks", {
      name: args.name,
      description: args.description,
      area: args.area,
      isPriority: args.isPriority,
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
    area: v.optional(v.string()),
    isPriority: v.optional(v.boolean()),
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
      area?: string | undefined;
      isPriority?: boolean;
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

    if (args.area !== undefined) {
      updates.area = args.area;
    }

    if (args.isPriority !== undefined) {
      updates.isPriority = args.isPriority;
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
// Historical submissions store check data (name, result, notes) inline as a snapshot,
// so deleting the template does not affect past records — checkId is optional.
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
        checkItems: v.array(checkItemValidator),
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
      // Users referenced by per-item completedBy, for attribution display
      itemUsers: v.array(
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
        .withIndex("by_date", (q) => q.eq("date", sundayTimestamp))
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

        // Determine the duty crew based on which Sunday of the month.
        // For the special 5th Sunday, fall back to crew number 1.
        const dutyCrewNumber = isSpecial ? 1 : sundayCount;
        const dutyCrew = await ctx.db
          .query("dutyCrew")
          .withIndex("by_number", (q) => q.eq("number", dutyCrewNumber))
          .first();

        if (dutyCrew) {
          dutyCrewId = dutyCrew._id;
        }
      }
    }

    if (!dutyCrewId) {
      return null;
    }
    const crewId = dutyCrewId;

    // Find an existing submission for this week and duty crew
    // We'll look for both draft and completed submissions
    // We'll also look for submissions created anytime during the current week
    const mondayTimestamp = currentWeekMonday.getTime();

    // First, try to find a submission specifically for this Sunday
    let submission = await ctx.db
      .query("stationCheckSubmissions")
      .withIndex("by_date_and_dutyCrew", (q) =>
        q.eq("date", sundayTimestamp).eq("dutyCrewId", crewId)
      )
      .order("desc") // Get the most recent one first
      .first();

    // If no submission is found for this Sunday specifically,
    // look for any submission created during the current week
    if (!submission) {
      submission = await ctx.db
        .query("stationCheckSubmissions")
        .withIndex("by_dutyCrew", (q) =>
          q
            .eq("dutyCrewId", crewId)
            .gte("_creationTime", mondayTimestamp)
            .lte("_creationTime", sundayTimestamp + 24 * 60 * 60 * 1000) // Include all of Sunday
        )
        .order("desc") // Get the most recent one first
        .first();
    }

    if (!submission) {
      return null;
    }

    // Get the duty crew information
    const dutyCrew = await ctx.db.get(crewId);
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

    // Resolve users referenced by per-item attribution (deduped)
    const itemUserIds = new Set<Id<"users">>();
    for (const item of submission.checkItems) {
      if (item.completedBy) {
        itemUserIds.add(item.completedBy);
      }
    }
    const itemUsers = [];
    for (const itemUserId of itemUserIds) {
      const itemUser = await ctx.db.get(itemUserId);
      if (itemUser) {
        itemUsers.push({
          _id: itemUser._id,
          name: itemUser.name || "",
          firstName: itemUser.firstName,
          lastName: itemUser.lastName,
        });
      }
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
      itemUsers,
    };
  },
});

// Save a draft station check (in-progress)
export const saveDraftStationCheck = mutation({
  args: {
    date: v.number(), // Timestamp for the date of submission
    dutyCrewId: v.id("dutyCrew"),
    checkItems: v.array(checkItemValidator),
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
      const existing = await ctx.db.get(args.existingSubmissionId);
      await ctx.db.patch(args.existingSubmissionId, {
        checkItems: applyItemAttribution(
          args.checkItems,
          existing?.checkItems,
          currentUser._id,
          now
        ),
        notes: args.notes,
        lastUpdatedBy: currentUser._id,
        lastUpdatedAt: now,
      });

      return args.existingSubmissionId;
    } else {
      // Check if there's already a submission for this date and duty crew
      const existingSubmission = await ctx.db
        .query("stationCheckSubmissions")
        .withIndex("by_date_and_dutyCrew", (q) =>
          q.eq("date", args.date).eq("dutyCrewId", args.dutyCrewId)
        )
        .first();

      if (existingSubmission) {
        // Update the existing submission
        await ctx.db.patch(existingSubmission._id, {
          checkItems: applyItemAttribution(
            args.checkItems,
            existingSubmission.checkItems,
            currentUser._id,
            now
          ),
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
          checkItems: applyItemAttribution(
            args.checkItems,
            undefined,
            currentUser._id,
            now
          ),
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
    checkItems: v.array(checkItemValidator),
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

    // Validate that all check items are resolved (completed or marked N/A)
    const incompleteItems = args.checkItems.filter(item => !isResolved(item));
    if (incompleteItems.length > 0) {
      const incompleteNames = incompleteItems.map(item => item.name).join(", ");
      throw new Error(`Cannot complete station check: The following items are not completed: ${incompleteNames}`);
    }

    const now = Date.now();

    // Raise the "checks are done" notice for whoever holds the duty-crew
    // portfolio. Silent unless an officer has mapped the condition key.
    const notifySubmission = async (submissionId: Id<"stationCheckSubmissions">) => {
      const crew = await ctx.db.get(args.dutyCrewId);
      const notice = buildSubmissionNotice(
        args.checkItems,
        crew?.name ?? "Duty crew",
        args.date
      );
      const submitterName =
        [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") ||
        currentUser.name ||
        "a crew member";

      await notifyEvent(ctx, {
        moduleId: "dutyCrew",
        conditionKey: CHECKS_SUBMITTED_KEY,
        title: "Duty crew checks submitted",
        description: notice.description,
        url: "/duty-crew?tab=history",
        priority: notice.attention.length > 0 ? "medium" : "low",
        sourceEntityId: submissionId,
        actorUserId: currentUser._id,
        emailSubject: `Duty crew checks submitted — week ending Sun ${notice.weekLabel}`,
        emailIntro: `${submitterName} submitted the station checks for ${crew?.name ?? "the duty crew"}.`,
        emailDetails: [
          { label: "Crew", value: crew?.name ?? "Unknown" },
          { label: "Week ending", value: `Sunday ${notice.weekLabel}` },
          { label: "Submitted by", value: submitterName },
          { label: "Result", value: notice.summary },
          ...(args.notes?.trim()
            ? [{ label: "Crew notes", value: args.notes.trim() }]
            : []),
        ],
        emailListTitle: "Needs attention",
        emailList: notice.attention,
      });
    };

    if (args.existingSubmissionId) {
      // Update the existing submission and mark as completed
      const existing = await ctx.db.get(args.existingSubmissionId);
      await ctx.db.patch(args.existingSubmissionId, {
        checkItems: applyItemAttribution(
          args.checkItems,
          existing?.checkItems,
          currentUser._id,
          now
        ),
        notes: args.notes,
        completedBy: currentUser._id,
        completedAt: now,
        status: "completed",
        lastUpdatedBy: currentUser._id,
        lastUpdatedAt: now,
      });

      await notifySubmission(args.existingSubmissionId);
      return args.existingSubmissionId;
    } else {
      // Check if there's already a submission for this date and duty crew
      const existingSubmission = await ctx.db
        .query("stationCheckSubmissions")
        .withIndex("by_date_and_dutyCrew", (q) =>
          q.eq("date", args.date).eq("dutyCrewId", args.dutyCrewId)
        )
        .first();

      if (existingSubmission) {
        // Update the existing submission and mark as completed
        await ctx.db.patch(existingSubmission._id, {
          checkItems: applyItemAttribution(
            args.checkItems,
            existingSubmission.checkItems,
            currentUser._id,
            now
          ),
          notes: args.notes,
          completedBy: currentUser._id,
          completedAt: now,
          status: "completed",
          lastUpdatedBy: currentUser._id,
          lastUpdatedAt: now,
        });

        await notifySubmission(existingSubmission._id);
        return existingSubmission._id;
      } else {
        // Create a new completed submission
        const submissionId = await ctx.db.insert("stationCheckSubmissions", {
          date: args.date,
          dutyCrewId: args.dutyCrewId,
          checkItems: applyItemAttribution(
            args.checkItems,
            undefined,
            currentUser._id,
            now
          ),
          notes: args.notes,
          completedBy: currentUser._id,
          completedAt: now,
          status: "completed",
          lastUpdatedBy: currentUser._id,
          lastUpdatedAt: now,
        });

        await notifySubmission(submissionId);
        return submissionId;
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

// Paginated station check history, newest first, optionally filtered to one crew
export const getStationCheckHistoryPage = query({
  args: {
    dutyCrewId: v.optional(v.id("dutyCrew")),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("stationCheckSubmissions"),
        date: v.number(),
        completedAt: v.number(),
        dutyCrew: v.union(
          v.object({ _id: v.id("dutyCrew"), name: v.string() }),
          v.null()
        ),
        completedBy: v.object({
          _id: v.id("users"),
          name: v.string(),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
        }),
        checkItems: v.array(
          v.object({
            checkId: v.optional(v.id("stationChecks")),
            name: v.string(),
            area: v.optional(v.string()),
            isPriority: v.optional(v.boolean()),
            isCompleted: v.boolean(),
            isNotApplicable: v.optional(v.boolean()),
            notes: v.optional(v.string()),
            isAdHoc: v.optional(v.boolean()),
            addedBy: v.optional(v.id("users")),
          })
        ),
        notes: v.optional(v.string()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null()
      )
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // Only surface completed submissions; use the date-ordered indexes
    const result = args.dutyCrewId
      ? await ctx.db
          .query("stationCheckSubmissions")
          .withIndex("by_dutyCrew_and_status_and_date", (q) =>
            q.eq("dutyCrewId", args.dutyCrewId!).eq("status", "completed")
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("stationCheckSubmissions")
          .withIndex("by_status_and_date", (q) => q.eq("status", "completed"))
          .order("desc")
          .paginate(args.paginationOpts);

    const userCache = new Map<Id<"users">, Doc<"users"> | null>();
    const crewCache = new Map<Id<"dutyCrew">, Doc<"dutyCrew"> | null>();

    const page = [];
    for (const submission of result.page) {
      let user = userCache.get(submission.completedBy);
      if (user === undefined) {
        user = await ctx.db.get(submission.completedBy);
        userCache.set(submission.completedBy, user);
      }
      let crew = crewCache.get(submission.dutyCrewId);
      if (crew === undefined) {
        crew = await ctx.db.get(submission.dutyCrewId);
        crewCache.set(submission.dutyCrewId, crew);
      }
      if (!user) continue;

      // Explicitly construct the return object — never spread the raw document
      // to avoid leaking undeclared fields (_creationTime, status, etc.)
      page.push({
        _id: submission._id,
        date: submission.date,
        completedAt: submission.completedAt,
        dutyCrew: crew
          ? { _id: crew._id, name: crew.name }
          : null,
        completedBy: {
          _id: user._id,
          name: user.name || "",
          firstName: user.firstName,
          lastName: user.lastName,
        },
        checkItems: submission.checkItems.map((item) => ({
          checkId: item.checkId,
          name: item.name,
          area: item.area,
          isPriority: item.isPriority,
          isCompleted: item.isCompleted,
          isNotApplicable: item.isNotApplicable,
          notes: item.notes,
          isAdHoc: item.isAdHoc,
          addedBy: item.addedBy,
        })),
        notes: submission.notes,
      });
    }

    return { ...result, page };
  },
});
