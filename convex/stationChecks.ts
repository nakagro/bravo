import { query, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { notifyEvent } from "./lib/notifyEvent";
import { brigadeDayOfWeek, brigadeParts, brigadeTimestamp } from "./lib/dates";

type SubmissionCheckItem = {
  checkId?: Id<"stationChecks">;
  subItemId?: Id<"stationCheckSubitems">;
  parentCheckId?: Id<"stationChecks">;
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
  subItemId: v.optional(v.id("stationCheckSubitems")),
  parentCheckId: v.optional(v.id("stationChecks")),
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

// The crew roster as it stood when the week was worked - see the schema note
// on stationCheckSubmissions.crewSnapshot for why it is stored rather than
// re-read from the dutyCrew doc.
const crewSnapshotValidator = v.object({
  name: v.string(),
  number: v.number(),
  capturedAt: v.number(),
  members: v.array(
    v.object({
      userId: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      isLeader: v.boolean(),
    })
  ),
});

type CrewSnapshot = {
  name: string;
  number: number;
  capturedAt: number;
  members: Array<{
    userId: Id<"users">;
    name?: string;
    firstName?: string;
    lastName?: string;
    isLeader: boolean;
  }>;
};

// Names are denormalized so a member who later leaves the brigade still shows
// on the week they worked.
async function buildCrewSnapshot(
  ctx: MutationCtx,
  dutyCrewId: Id<"dutyCrew">
): Promise<CrewSnapshot | undefined> {
  const crew = await ctx.db.get(dutyCrewId);
  if (!crew) return undefined;

  const members: CrewSnapshot["members"] = [];
  for (const memberId of crew.members) {
    const member = await ctx.db.get(memberId);
    if (!member) continue;
    members.push({
      userId: member._id,
      name: member.name,
      firstName: member.firstName,
      lastName: member.lastName,
      isLeader: crew.leader === member._id,
    });
  }

  return {
    name: crew.name,
    number: crew.number,
    capturedAt: Date.now(),
    members,
  };
}

// Fill the snapshot in on an existing submission that predates it. Once
// captured it is left alone, so the roster reflects the week as worked rather
// than the roster at the moment of the last edit.
async function crewSnapshotPatch(
  ctx: MutationCtx,
  submission: Doc<"stationCheckSubmissions"> | null | undefined,
  dutyCrewId: Id<"dutyCrew">
): Promise<{ crewSnapshot?: CrewSnapshot }> {
  if (!submission || submission.crewSnapshot) return {};
  const crewSnapshot = await buildCrewSnapshot(ctx, dutyCrewId);
  return crewSnapshot ? { crewSnapshot } : {};
}

const subItemValidator = v.object({
  _id: v.id("stationCheckSubitems"),
  name: v.string(),
  order: v.number(),
});

const MAX_SUBITEMS_PER_CHECK = 20;

function normalizeSubItemNames(names: string[]) {
  if (names.length > MAX_SUBITEMS_PER_CHECK) {
    throw new Error(`A check can have at most ${MAX_SUBITEMS_PER_CHECK} subitems`);
  }

  const normalized = names.map((name) => name.trim()).filter(Boolean);
  const seen = new Set<string>();
  for (const name of normalized) {
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      throw new Error("Subitem names must be unique within a check");
    }
    seen.add(key);
  }
  return normalized;
}

async function replaceStationCheckSubitems(
  ctx: MutationCtx,
  stationCheckId: Id<"stationChecks">,
  names: string[],
  now: number
) {
  const normalized = normalizeSubItemNames(names);
  const existing = await ctx.db
    .query("stationCheckSubitems")
    .withIndex("by_stationCheckId_and_order", (q) =>
      q.eq("stationCheckId", stationCheckId)
    )
    .take(MAX_SUBITEMS_PER_CHECK + 1);

  for (let index = 0; index < normalized.length; index++) {
    const current = existing[index];
    if (current) {
      await ctx.db.patch(current._id, {
        name: normalized[index],
        order: index,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("stationCheckSubitems", {
        stationCheckId,
        name: normalized[index],
        order: index,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  for (const stale of existing.slice(normalized.length)) {
    await ctx.db.delete(stale._id);
  }
}

// Stamp per-item completedBy/completedAt server-side. Attribution set when an
// item is newly resolved (completed or marked N/A), preserved when it was
// already resolved the same way in the existing submission, and cleared when
// unresolved. Completed and N/A are mutually exclusive - completed wins if a
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
    const prev = existing?.find((e) => {
      if (item.subItemId) return e.subItemId === item.subItemId;
      if (item.checkId) return e.checkId === item.checkId;
      return !e.checkId && !e.subItemId && e.name === item.name;
    });
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

// A week's submission is keyed by its Sunday, but the client sends the Sunday
// as end-of-day (23:59:59.999) while the reader used to normalise it to
// midnight - so a draft was written under one key and looked up under another
// and every tick appeared to vanish on reload. Match on the whole Mon–Sun
// window instead, which is also tolerant of the timestamps already in the
// database from before this was fixed.
//
// The week is a *Melbourne* Mon–Sun, resolved through `convex/lib/dates.ts`
// rather than the runtime's own clock, which is UTC. Built with local-time
// `setHours`/`getDay` this window used to run Mon 10:00 AEST to the following
// Mon 09:59, so a station check or inventory run done on Monday morning - the
// usual time - counted toward the week that had just ended.
export function weekWindow(date: number) {
  const p = brigadeParts(date);
  const day = brigadeDayOfWeek(date); // 0 = Sunday

  // Melbourne's civil Monday and Sunday of this week. Date.UTC normalises the
  // month/year rollover, and the fields are read back as UTC because that is
  // the calendar arithmetic - not an instant - being done here.
  const mondayCivil = new Date(
    Date.UTC(p.year, p.month - 1, p.day - (day === 0 ? 6 : day - 1))
  );
  const sundayCivil = new Date(mondayCivil.getTime() + 6 * 24 * 60 * 60 * 1000);

  const start = brigadeTimestamp(
    mondayCivil.getUTCFullYear(),
    mondayCivil.getUTCMonth() + 1,
    mondayCivil.getUTCDate()
  );
  const end = brigadeTimestamp(
    sundayCivil.getUTCFullYear(),
    sundayCivil.getUTCMonth() + 1,
    sundayCivil.getUTCDate(),
    23,
    59,
    59,
    999
  );

  // `sunday` stays a UTC-midnight Date of the Sunday's *calendar date*, which
  // is the key convention `dutyCrewSchedule.date` is written under (see
  // dutyCrew.ts:178) and what the callers reading .getMonth()/.getDate() off
  // it expect on a UTC runtime.
  return { start, end, sunday: sundayCivil };
}

// Find the submission covering the week that `date` falls in. A week has one
// submission; the duty crew is whatever it was saved under, not whatever the
// rotation rule derives now, because the two can disagree (manual schedule
// overrides, 5th Sundays) and a mismatch used to hide the draft entirely.
async function findSubmissionForWeek(
  ctx: QueryCtx,
  date: number,
  preferredCrewId?: Id<"dutyCrew">
): Promise<Doc<"stationCheckSubmissions"> | null> {
  const { start, end } = weekWindow(date);

  const candidates = await ctx.db
    .query("stationCheckSubmissions")
    .withIndex("by_date", (q) => q.gte("date", start).lte("date", end))
    .collect();

  if (candidates.length === 0) return null;
  if (preferredCrewId) {
    const forCrew = candidates.filter((s) => s.dutyCrewId === preferredCrewId);
    if (forCrew.length > 0) candidates.splice(0, candidates.length, ...forCrew);
  }
  // Most recently touched wins if a duplicate ever slipped through
  return candidates.reduce((latest, s) =>
    (s.lastUpdatedAt ?? s._creationTime) > (latest.lastUpdatedAt ?? latest._creationTime)
      ? s
      : latest
  );
}

// Condition key for "the week's station checks were submitted". Officers map it
// to themselves in Duty Crew → Admin → Notifications.
export const CHECKS_SUBMITTED_KEY = "dutyCrew:checksSubmitted";

// Build the notice a duty-crew submission raises. The point of the whole thing
// is the exception detail: pen-and-paper sheets told nobody what was skipped or
// what needed a second look, so untouched items, N/A items and anything with a
// note are named.
//
// Naming the untouched items is what lets a week be submitted unfinished at
// all: there is no submit gate, so this notice IS the follow-up mechanism.
export function buildSubmissionNotice(
  items: SubmissionCheckItem[],
  crewName: string,
  weekEnding: number
) {
  const completed = items.filter((i) => i.isCompleted).length;
  const notApplicable = items.filter((i) => !i.isCompleted && i.isNotApplicable === true);
  const notDone = items.filter((i) => !isResolved(i));
  const withNotes = items.filter((i) => i.notes && i.notes.trim().length > 0);

  const weekLabel = new Date(weekEnding).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });

  const summary = [
    `${completed} of ${items.length} completed`,
    notApplicable.length > 0 ? `${notApplicable.length} N/A` : null,
    notDone.length > 0 ? `${notDone.length} not done` : null,
    withNotes.length > 0 ? `${withNotes.length} with notes` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const attention = [
    // Untouched items lead: they're the ones nobody has accounted for.
    ...notDone.map(
      (i) => `${i.name} - not done${i.notes ? `: ${i.notes.trim()}` : ""}`
    ),
    ...notApplicable.map(
      (i) => `${i.name} - marked N/A${i.notes ? `: ${i.notes.trim()}` : ""}`
    ),
    ...withNotes
      .filter((i) => i.isNotApplicable !== true && isResolved(i))
      .map((i) => `${i.name} - ${i.notes!.trim()}`),
  ];

  return {
    weekLabel,
    summary,
    attention,
    notDoneCount: notDone.length,
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
      subItems: v.array(subItemValidator),
    })
  ),
  handler: async (ctx, args) => {
    const includeInactive = args.includeInactive ?? false;

    const checks = includeInactive
      ? await ctx.db.query("stationChecks").take(500)
      : await ctx.db
          .query("stationChecks")
          .withIndex("by_isActive", (q) => q.eq("isActive", true))
          .take(500);

    const orderedChecks = checks.sort((a, b) => a.order - b.order);
    const subItemGroups = await Promise.all(
      orderedChecks.map((check) =>
        ctx.db
          .query("stationCheckSubitems")
          .withIndex("by_stationCheckId_and_order", (q) =>
            q.eq("stationCheckId", check._id)
          )
          .take(MAX_SUBITEMS_PER_CHECK)
      )
    );

    return orderedChecks
      .map((check, index) => ({
        ...check,
        subItems: subItemGroups[index]
          .map(({ _id, name, order }) => ({ _id, name, order })),
      }));
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
    subItems: v.array(subItemValidator),
  }),
  handler: async (ctx, args) => {
    const check = await ctx.db.get(args.id);
    if (!check) {
      throw new Error("Station check not found");
    }
    const subItems = await ctx.db
      .query("stationCheckSubitems")
      .withIndex("by_stationCheckId_and_order", (q) =>
        q.eq("stationCheckId", check._id)
      )
      .take(MAX_SUBITEMS_PER_CHECK);
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
      subItems: subItems.map(({ _id, name, order }) => ({ _id, name, order })),
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
    subItems: v.optional(v.array(v.string())),
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
    const stationCheckId = await ctx.db.insert("stationChecks", {
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
    await replaceStationCheckSubitems(ctx, stationCheckId, args.subItems ?? [], now);
    return stationCheckId;
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
    subItems: v.optional(v.array(v.string())),
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
    if (args.subItems !== undefined) {
      await replaceStationCheckSubitems(ctx, args.id, args.subItems, updates.updatedAt);
    }
    return args.id;
  },
});

// Delete a station check
// Historical submissions store check data (name, result, notes) inline as a snapshot,
// so deleting the template does not affect past records - checkId is optional.
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

    const subItems = await ctx.db
      .query("stationCheckSubitems")
      .withIndex("by_stationCheckId_and_order", (q) =>
        q.eq("stationCheckId", args.id)
      )
      .take(MAX_SUBITEMS_PER_CHECK + 1);
    for (const subItem of subItems) {
      await ctx.db.delete(subItem._id);
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
        crewSnapshot: v.optional(crewSnapshotValidator),
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
    const { sunday: currentWeekSunday } = weekWindow(args.date ?? Date.now());
    const sundayTimestamp = new Date(currentWeekSunday).setHours(0, 0, 0, 0);

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

    // Find this week's submission (draft or completed). The crew derived above
    // is only a preference - the submission's own crew is authoritative.
    const submission = await findSubmissionForWeek(
      ctx,
      args.date ?? Date.now(),
      dutyCrewId ?? undefined
    );

    if (!submission) {
      return null;
    }

    // Get the duty crew information
    const dutyCrew = await ctx.db.get(submission.dutyCrewId);
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
        ...(await crewSnapshotPatch(ctx, existing, args.dutyCrewId)),
      });

      return args.existingSubmissionId;
    } else {
      // Check if this week already has a submission
      const existingSubmission = await findSubmissionForWeek(
        ctx,
        args.date,
        args.dutyCrewId
      );

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
          ...(await crewSnapshotPatch(ctx, existingSubmission, args.dutyCrewId)),
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
          crewSnapshot: await buildCrewSnapshot(ctx, args.dutyCrewId),
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

    // Deliberately no completeness gate. Gating submission on a fully ticked
    // sheet just left weeks sitting in draft forever, which told the officer
    // nothing at all. An unfinished week submits, and the notice below names
    // exactly what was left undone so it can be followed up.

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
        url: "/dutycrew?tab=history",
        priority: notice.notDoneCount > 0 || notice.attention.length > 0 ? "medium" : "low",
        sourceEntityId: submissionId,
        actorUserId: currentUser._id,
        emailSubject:
          notice.notDoneCount > 0
            ? `Duty crew checks submitted with ${notice.notDoneCount} item${notice.notDoneCount === 1 ? "" : "s"} outstanding - week ending Sun ${notice.weekLabel}`
            : `Duty crew checks submitted - week ending Sun ${notice.weekLabel}`,
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
        ...(await crewSnapshotPatch(ctx, existing, args.dutyCrewId)),
      });

      await notifySubmission(args.existingSubmissionId);
      return args.existingSubmissionId;
    } else {
      // Check if this week already has a submission
      const existingSubmission = await findSubmissionForWeek(
        ctx,
        args.date,
        args.dutyCrewId
      );

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
          ...(await crewSnapshotPatch(ctx, existingSubmission, args.dutyCrewId)),
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
          crewSnapshot: await buildCrewSnapshot(ctx, args.dutyCrewId),
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
            subItemId: v.optional(v.id("stationCheckSubitems")),
            parentCheckId: v.optional(v.id("stationChecks")),
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

      // Explicitly construct the return object - never spread the raw document
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
          subItemId: item.subItemId,
          parentCheckId: item.parentCheckId,
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
