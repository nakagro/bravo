import {
  query,
  mutation,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { notifyEvent } from "./lib/notifyEvent";
import { brigadeDayOfWeek, brigadeParts, brigadeTimestamp } from "./lib/dates";
import { resolveCrewForSunday } from "./lib/dutyCrewRotation";

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
  // Which inventory template satisfied this item, and which run did it. Stored
  // so a submitted week renders from the record instead of re-deriving.
  linkedApplianceTemplateId?: Id<"applianceTemplates">;
  linkedRunId?: Id<"applianceCheckRuns">;
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
  linkedApplianceTemplateId: v.optional(v.id("applianceTemplates")),
  linkedRunId: v.optional(v.id("applianceCheckRuns")),
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
// and every tick appeared to vanish on reload. Match on the whole week window
// instead, which is also tolerant of the timestamps already in the database
// from before this was fixed.
//
// The week runs Tuesday to Monday, because the duty officer - and with them
// the duty crew - changes over at Tuesday training night. A crew that misses
// its weekend checks can still catch up on the Monday night. The week is still
// named by the Sunday inside it (the nth-Sunday rotation and
// `dutyCrewSchedule.date` both key on it), which is also why submissions keyed
// under the old Mon-Sun window (Sunday 23:59) still land in the right week.
//
// The week is a *Melbourne* week, resolved through `convex/lib/dates.ts`
// rather than the runtime's own clock, which is UTC.
const DAY_MS = 24 * 60 * 60 * 1000;

export function weekWindow(date: number) {
  const p = brigadeParts(date);
  const day = brigadeDayOfWeek(date); // 0 = Sunday
  const daysSinceTuesday = (day + 5) % 7;

  // Melbourne's civil Tuesday, Sunday and Monday of this week. Date.UTC
  // normalises the month/year rollover, and the fields are read back as UTC
  // because that is the calendar arithmetic - not an instant - being done here.
  const tuesdayCivil = new Date(
    Date.UTC(p.year, p.month - 1, p.day - daysSinceTuesday)
  );
  const sundayCivil = new Date(tuesdayCivil.getTime() + 5 * DAY_MS);
  const mondayCivil = new Date(tuesdayCivil.getTime() + 6 * DAY_MS);

  const start = brigadeTimestamp(
    tuesdayCivil.getUTCFullYear(),
    tuesdayCivil.getUTCMonth() + 1,
    tuesdayCivil.getUTCDate()
  );
  const end = brigadeTimestamp(
    mondayCivil.getUTCFullYear(),
    mondayCivil.getUTCMonth() + 1,
    mondayCivil.getUTCDate(),
    23,
    59,
    59,
    999
  );

  // `sunday` stays a UTC-midnight Date of the Sunday's *calendar date*, which
  // is the key convention `dutyCrewSchedule.date` is written under (see
  // dutyCrew.ts:178) and what the callers reading .getMonth()/.getDate() off
  // it expect on a UTC runtime. It is also what "week ending" labels show.
  return { start, end, sunday: sundayCivil };
}

// Find the submission covering the week that `date` falls in. A week has one
// submission; the duty crew is whatever it was saved under, not whatever the
// rotation rule derives now, because the two can disagree (manual schedule
// overrides, 5th Sundays) and a mismatch used to hide the draft entirely.
export async function findSubmissionForWeek(
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

  // Members know a duty week by its Sunday, even though it runs on to the
  // Monday night, so label it that way whatever timestamp in the week the
  // submission is keyed under. `sunday` is a civil date held as UTC midnight,
  // so it is formatted in UTC.
  const weekLabel = weekWindow(weekEnding).sunday.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
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
      linkedApplianceTemplateId: v.optional(v.id("applianceTemplates")),
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
    linkedApplianceTemplateId: v.optional(v.id("applianceTemplates")),
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
      linkedApplianceTemplateId: args.linkedApplianceTemplateId,
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
    // null clears the link; omitted leaves it untouched. The two need to be
    // distinguishable, and an optional id alone can't say "remove this".
    linkedApplianceTemplateId: v.optional(
      v.union(v.id("applianceTemplates"), v.null())
    ),
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
      linkedApplianceTemplateId?: Id<"applianceTemplates"> | undefined;
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

    if (args.linkedApplianceTemplateId !== undefined) {
      updates.linkedApplianceTemplateId =
        args.linkedApplianceTemplateId ?? undefined;
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

// ─── Linked inventory checks ────────────────────────────────────────────────
//
// A station check can be satisfied by completing an inventory run instead of
// being ticked. The derived state lives here so the query, the save path and
// the submit path all agree on what "resolved" means for a linked item.

type LinkedInventoryState = {
  templateId: Id<"applianceTemplates">;
  templateName: string;
  templateStatus: "active" | "inactive" | "archived";
  completedRunId?: Id<"applianceCheckRuns">;
  completedAt?: number;
  completedBy?: Id<"users">;
  inProgressRunId?: Id<"applianceCheckRuns">;
};

// Bounded: roughly one run per template per week, so 100 is about two years of
// history and far more than the one week this actually looks at.
const LINKED_RUN_SCAN = 100;

// Resolve every linked template to the state of its run for the week `date`
// falls in, keyed by template id. Shared by the query and both mutations.
async function deriveLinkedInventory(
  ctx: QueryCtx | MutationCtx,
  date: number
): Promise<Map<Id<"applianceTemplates">, LinkedInventoryState>> {
  const checks = await ctx.db
    .query("stationChecks")
    .withIndex("by_isActive", (q) => q.eq("isActive", true))
    .take(500);

  const templateIds = [
    ...new Set(
      checks
        .map((c) => c.linkedApplianceTemplateId)
        .filter((id): id is Id<"applianceTemplates"> => id !== undefined)
    ),
  ];

  const { start, end } = weekWindow(date);
  const states = new Map<Id<"applianceTemplates">, LinkedInventoryState>();

  for (const templateId of templateIds) {
    const template = await ctx.db.get(templateId);
    // A dangling id shouldn't happen - permanent delete clears links - but
    // treat a missing template as "hide the row" rather than throwing, so one
    // bad link can't take out the whole weekly checklist.
    if (!template) continue;

    const runs = await ctx.db
      .query("applianceCheckRuns")
      .withIndex("by_template", (q) => q.eq("templateId", templateId))
      .order("desc")
      .take(LINKED_RUN_SCAN);

    // Newest completed run whose completedAt lands inside this week. Runs come
    // back newest-first, so the first match is the one to report.
    const completed = runs.find(
      (r) =>
        r.status === "completed" &&
        r.completedAt !== undefined &&
        r.completedAt >= start &&
        r.completedAt <= end
    );
    const inProgress = runs.find((r) => r.status === "in_progress");

    states.set(templateId, {
      templateId,
      templateName: template.name,
      templateStatus: template.status ?? "active",
      completedRunId: completed?._id,
      completedAt: completed?.completedAt,
      completedBy: completed?.completedBy,
      inProgressRunId: inProgress?._id,
    });
  }

  return states;
}

// Map every active station check that carries a link to the derived state of
// its template, keyed by check id.
async function linkedChecksFor(
  ctx: QueryCtx | MutationCtx,
  date: number
): Promise<Map<Id<"stationChecks">, LinkedInventoryState>> {
  const checks = await ctx.db
    .query("stationChecks")
    .withIndex("by_isActive", (q) => q.eq("isActive", true))
    .take(500);

  const linked = checks.filter((c) => c.linkedApplianceTemplateId !== undefined);
  if (linked.length === 0) return new Map();

  const states = await deriveLinkedInventory(ctx, date);
  const byCheck = new Map<Id<"stationChecks">, LinkedInventoryState>();
  for (const check of linked) {
    const state = states.get(check.linkedApplianceTemplateId!);
    if (state) byCheck.set(check._id, state);
  }
  return byCheck;
}

// The write path for a submission's items.
//
// The client posts the whole checkItems array on every autosave, so a "locked"
// row is only locked if the server says so: without this, a crafted request
// could tick off a 200-item inventory that nobody did.
//
// Linked items are deliberately kept *out* of applyItemAttribution rather than
// overridden after it. That function's job is to preserve prior attribution,
// which is meaningless for derived state - and worse, a newly-resolved linked
// item has no matching `prev`, so it would be stamped with the id of whoever
// happened to trigger the autosave. The credit belongs to whoever completed
// the inventory run.
async function resolveSubmissionItems(
  ctx: MutationCtx,
  incoming: SubmissionCheckItem[],
  existing: SubmissionCheckItem[] | undefined,
  // Absent when the system is writing (the week close-out): ticked items then
  // keep exactly the attribution they already carry, and only derived rows
  // are refreshed.
  userId: Id<"users"> | undefined,
  now: number,
  date: number
): Promise<SubmissionCheckItem[]> {
  const attribute = (items: SubmissionCheckItem[]) =>
    userId ? applyItemAttribution(items, existing, userId, now) : items;

  const links = await linkedChecksFor(ctx, date);
  if (links.size === 0) {
    return attribute(incoming);
  }

  const linkOf = (item: SubmissionCheckItem) =>
    item.checkId ? links.get(item.checkId) : undefined;

  // Attribution still runs, just on the items it means something for. Order
  // and length are preserved, so the results zip back in a single pass.
  const attributed = attribute(incoming.filter((item) => !linkOf(item)));

  let next = 0;
  return incoming.map((item) => {
    const link = linkOf(item);
    if (!link) return attributed[next++];

    const isCompleted = link.completedRunId !== undefined;
    return {
      ...item,
      isCompleted,
      // A derived row is never N/A: it is either done or it isn't.
      isNotApplicable: undefined,
      linkedApplianceTemplateId: link.templateId,
      linkedRunId: link.completedRunId,
      // From the run, not the saving user.
      completedBy: isCompleted ? link.completedBy : undefined,
      completedAt: isCompleted ? link.completedAt : undefined,
    };
  });
}

export const getLinkedInventoryStatus = query({
  args: {
    date: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      templateId: v.id("applianceTemplates"),
      templateName: v.string(),
      templateStatus: v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("archived")
      ),
      completedRunId: v.optional(v.id("applianceCheckRuns")),
      completedAt: v.optional(v.number()),
      completedBy: v.optional(v.id("users")),
      completedByName: v.optional(v.string()),
      // templateStatus is what the checklist hides on: an appliance that is
      // off the run has no check to do, so the row disappears rather than
      // sitting there permanently unresolved.
      inProgressRunId: v.optional(v.id("applianceCheckRuns")),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const states = await deriveLinkedInventory(ctx, args.date ?? Date.now());

    return await Promise.all(
      [...states.values()].map(async (state) => {
        // Denormalised for display: the row says who did the inventory, and
        // that name has to survive them leaving the brigade.
        let completedByName: string | undefined;
        if (state.completedBy) {
          const user = await ctx.db.get(state.completedBy);
          completedByName = user
            ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.name ||
              undefined
            : undefined;
        }
        return { ...state, completedByName };
      })
    );
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
        completedBy: v.optional(v.id("users")),
        completedAt: v.number(),
        status: v.union(v.literal("draft"), v.literal("completed")),
        closedAt: v.optional(v.number()),
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
      completedBy: v.optional(
        v.object({
          _id: v.id("users"),
          name: v.string(),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
        })
      ),
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

    // Who started the record. A week the close-out created on its own has
    // nobody, and a deleted user must not hide the week either.
    const user = submission.completedBy
      ? await ctx.db.get(submission.completedBy)
      : null;

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
      completedBy: user
        ? {
            _id: user._id,
            name: user.name || "",
            firstName: user.firstName,
            lastName: user.lastName,
          }
        : undefined,
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
        checkItems: await resolveSubmissionItems(
          ctx,
          args.checkItems,
          existing?.checkItems,
          currentUser._id,
          now,
          args.date,
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
          checkItems: await resolveSubmissionItems(
            ctx,
            args.checkItems,
            existingSubmission.checkItems,
            currentUser._id,
            now,
            args.date,
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
          checkItems: await resolveSubmissionItems(
            ctx,
            args.checkItems,
            undefined,
            currentUser._id,
            now,
            args.date,
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

// DEPRECATED - weeks now close on their own (closeElapsedWeeks). Kept only
// so a frontend still running the old Complete Checks button keeps working
// until the new one is live on prod; delete it and reopenStationCheck then.
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
        checkItems: await resolveSubmissionItems(
          ctx,
          args.checkItems,
          existing?.checkItems,
          currentUser._id,
          now,
          args.date,
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
          checkItems: await resolveSubmissionItems(
            ctx,
            args.checkItems,
            existingSubmission.checkItems,
            currentUser._id,
            now,
            args.date,
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
          checkItems: await resolveSubmissionItems(
            ctx,
            args.checkItems,
            undefined,
            currentUser._id,
            now,
            args.date,
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

// DEPRECATED - see submitStationCheck. A closed week is edited in place now.
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

// ---------------------------------------------------------------------------
// Week close-out
//
// A duty week is a set of chores that either got done or didn't. It closes on
// its own at the Tuesday boundary - nobody has to come back and press a button
// to say so - and the summary email goes out then, naming what was and wasn't
// done. That email is the follow-up mechanism; there is no submit gate.
// ---------------------------------------------------------------------------

// Drafts closed per transaction. Normally there is one (last week); the first
// run after this shipped also sweeps up every week that was left in draft
// under the old manual-submit flow.
const CLOSE_BATCH = 25;

// The checklist a week starts from when nobody opened it at all - the same
// shape the This Week tab seeds before the first tick.
async function blankWeekItems(ctx: QueryCtx): Promise<SubmissionCheckItem[]> {
  const checks = await ctx.db
    .query("stationChecks")
    .withIndex("by_isActive", (q) => q.eq("isActive", true))
    .take(500);
  checks.sort((a, b) => a.order - b.order);

  const items: SubmissionCheckItem[] = [];
  for (const check of checks) {
    items.push({
      checkId: check._id,
      name: check.name,
      area: check.area,
      isPriority: check.isPriority,
      isCompleted: false,
    });
    const subItems = await ctx.db
      .query("stationCheckSubitems")
      .withIndex("by_stationCheckId_and_order", (q) =>
        q.eq("stationCheckId", check._id)
      )
      .take(MAX_SUBITEMS_PER_CHECK);
    for (const subItem of subItems) {
      items.push({
        subItemId: subItem._id,
        parentCheckId: check._id,
        name: subItem.name,
        area: check.area,
        isCompleted: false,
      });
    }
  }
  return items;
}

// The final state of a week's items: linked rows re-derived from that week's
// inventory runs and then frozen, and rows for appliances that are off the run
// dropped - the checklist hides those, so reporting them as "not done" would
// be wrong. Ticked items keep their attribution untouched.
async function finalWeekItems(
  ctx: MutationCtx,
  items: SubmissionCheckItem[],
  date: number,
  now: number
): Promise<SubmissionCheckItem[]> {
  const resolved = await resolveSubmissionItems(ctx, items, items, undefined, now, date);
  const links = await linkedChecksFor(ctx, date);
  return resolved.filter((item) => {
    const link = item.checkId ? links.get(item.checkId) : undefined;
    return !link || link.templateStatus === "active";
  });
}

async function notifyWeekClosed(
  ctx: MutationCtx,
  submission: Pick<
    Doc<"stationCheckSubmissions">,
    "_id" | "date" | "dutyCrewId" | "checkItems" | "notes" | "crewSnapshot"
  >
) {
  const crew = await ctx.db.get(submission.dutyCrewId);
  const crewName = submission.crewSnapshot?.name ?? crew?.name ?? "Duty crew";
  const notice = buildSubmissionNotice(submission.checkItems, crewName, submission.date);
  const nothingRecorded = submission.checkItems.every((i) => !isResolved(i));

  await notifyEvent(ctx, {
    moduleId: "dutyCrew",
    conditionKey: CHECKS_SUBMITTED_KEY,
    title: "Duty crew week closed",
    description: notice.description,
    url: "/dutycrew?tab=history",
    priority: notice.notDoneCount > 0 || notice.attention.length > 0 ? "medium" : "low",
    sourceEntityId: submission._id,
    emailSubject:
      notice.notDoneCount > 0
        ? `Duty crew week ending Sun ${notice.weekLabel}: ${notice.notDoneCount} item${notice.notDoneCount === 1 ? "" : "s"} not done`
        : `Duty crew week ending Sun ${notice.weekLabel}: all checks done`,
    emailIntro: nothingRecorded
      ? `The station checks week for ${crewName} has closed with nothing recorded against it.`
      : `The station checks week for ${crewName} has closed. Here is what was and wasn't done.`,
    emailDetails: [
      { label: "Crew", value: crewName },
      { label: "Week ending", value: `Sunday ${notice.weekLabel}` },
      { label: "Result", value: notice.summary },
      ...(submission.notes?.trim()
        ? [{ label: "Crew notes", value: submission.notes.trim() }]
        : []),
    ],
    emailListTitle: "Needs attention",
    emailList: notice.attention,
  });
}

// Close every week that has ended. Runs daily from crons.ts; it catches up on
// whatever is overdue rather than firing at an exact instant, so the fixed-UTC
// cron schedule and DST don't matter, and a missed run just closes the week
// on the next one. Idempotent: a closed week is never touched again.
//
// Only the week that has just ended is emailed. Anything older was abandoned
// in draft under the old manual-submit flow; it is closed silently so it shows
// up in History, rather than mailing the officer about months-old weeks.
export const closeElapsedWeeks = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const thisWeek = weekWindow(now);
    const lastWeek = weekWindow(thisWeek.start - 1);

    const elapsed = await ctx.db
      .query("stationCheckSubmissions")
      .withIndex("by_status_and_date", (q) =>
        q.eq("status", "draft").lt("date", thisWeek.start)
      )
      .take(CLOSE_BATCH);

    for (const submission of elapsed) {
      const checkItems = await finalWeekItems(
        ctx,
        submission.checkItems,
        submission.date,
        now
      );
      const isLastWeek = submission.date >= lastWeek.start;
      // Today's roster is a fair record of the week that just ended, but not
      // of one months ago - leave an old week without a snapshot rather than
      // naming the wrong people.
      const snapshot = isLastWeek
        ? await crewSnapshotPatch(ctx, submission, submission.dutyCrewId)
        : {};
      await ctx.db.patch(submission._id, {
        checkItems,
        status: "completed",
        closedAt: now,
        ...snapshot,
      });
      if (isLastWeek) {
        await notifyWeekClosed(ctx, {
          ...submission,
          checkItems,
          crewSnapshot: submission.crewSnapshot ?? snapshot.crewSnapshot,
        });
      }
    }

    if (elapsed.length === CLOSE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.stationChecks.closeElapsedWeeks, {});
      return null;
    }

    // A week nobody opened still closes, and still reports - an untouched week
    // is exactly what the officer needs to hear about. Reads see the patches
    // above, so a week that was just closed is found here and skipped.
    if (await findSubmissionForWeek(ctx, lastWeek.end)) return null;

    const { crew } = await resolveCrewForSunday(ctx, lastWeek.sunday);
    if (!crew) return null;

    const checkItems = await finalWeekItems(
      ctx,
      await blankWeekItems(ctx),
      lastWeek.end,
      now
    );
    if (checkItems.length === 0) return null;

    const crewSnapshot = await buildCrewSnapshot(ctx, crew._id);
    const submissionId = await ctx.db.insert("stationCheckSubmissions", {
      // Any instant inside the week keys it (lookups match on the window). The
      // This Week tab writes Sunday 23:59:59.999; the window's end is as good.
      date: lastWeek.end,
      dutyCrewId: crew._id,
      checkItems,
      completedAt: now,
      status: "completed",
      closedAt: now,
      crewSnapshot,
    });
    await notifyWeekClosed(ctx, {
      _id: submissionId,
      date: lastWeek.end,
      dutyCrewId: crew._id,
      checkItems,
      crewSnapshot,
    });
    return null;
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
        closedAt: v.optional(v.number()),
        dutyCrew: v.union(
          v.object({ _id: v.id("dutyCrew"), name: v.string() }),
          v.null()
        ),
        completedBy: v.optional(
          v.object({
            _id: v.id("users"),
            name: v.string(),
            firstName: v.optional(v.string()),
            lastName: v.optional(v.string()),
          })
        ),
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
            linkedApplianceTemplateId: v.optional(v.id("applianceTemplates")),
            linkedRunId: v.optional(v.id("applianceCheckRuns")),
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
      let user: Doc<"users"> | null = null;
      if (submission.completedBy) {
        const cached = userCache.get(submission.completedBy);
        user = cached === undefined ? await ctx.db.get(submission.completedBy) : cached;
        userCache.set(submission.completedBy, user);
      }
      let crew = crewCache.get(submission.dutyCrewId);
      if (crew === undefined) {
        crew = await ctx.db.get(submission.dutyCrewId);
        crewCache.set(submission.dutyCrewId, crew);
      }

      // Explicitly construct the return object - never spread the raw document
      // to avoid leaking undeclared fields (_creationTime, status, etc.)
      page.push({
        _id: submission._id,
        date: submission.date,
        completedAt: submission.completedAt,
        closedAt: submission.closedAt,
        dutyCrew: crew
          ? { _id: crew._id, name: crew.name }
          : null,
        completedBy: user
          ? {
              _id: user._id,
              name: user.name || "",
              firstName: user.firstName,
              lastName: user.lastName,
            }
          : undefined,
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
          linkedApplianceTemplateId: item.linkedApplianceTemplateId,
          linkedRunId: item.linkedRunId,
        })),
        notes: submission.notes,
      });
    }

    return { ...result, page };
  },
});
