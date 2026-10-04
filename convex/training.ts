import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { isMemberAccount } from "./lib/accountType";
import { compareBySeniority, isValidLieutenantNumber, type Rank } from "./lib/ranks";
import { isTuesday, tuesdayKind, tuesdaysBetween } from "./lib/rollNights";
import { moduleSettingAllows } from "./modules";

// Training roll. See docs/plans/training-roll-plan.md.
//
// Two levels of access. The `training` module (officers by default) runs the
// roll: marks, closing, the member list, the report. The current Duty Officer
// can additionally record apologies - that's how an apology phoned in to the
// DO gets onto the roll before the night - without being given the rest.

const rankValidator = v.union(
  v.literal("Brigade Member"),
  v.literal("Probationary"),
  v.literal("Firefighter"),
  v.literal("Lieutenant"),
  v.literal("Captain")
);
const markStatusValidator = v.union(v.literal("present"), v.literal("apology"), v.literal("absent"));
const nightKindValidator = v.union(v.literal("training"), v.literal("meeting"), v.literal("other"));
const nightStatusValidator = v.union(v.literal("open"), v.literal("closed"), v.literal("cancelled"));

// Who a mark is for: a roll member, or a member account not on the roll list yet
const whoValidator = v.union(
  v.object({ rollMemberId: v.id("rollMembers") }),
  v.object({ userId: v.id("users") })
);

type MarkStatus = "present" | "apology" | "absent";

// ─── Access ────────────────────────────────────────────────────────────────

async function accessFor(ctx: QueryCtx | MutationCtx, user: Doc<"users">) {
  if (user.isDisabled) return { canManage: false, canRecordApologies: false };
  const setting = await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", "training"))
    .first();
  const canManage = user.isAdmin === true || moduleSettingAllows(user, setting);
  return { canManage, canRecordApologies: canManage || user.isDutyOfficer === true };
}

async function requireAccess(ctx: MutationCtx, need: "manage" | "apologies") {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  const access = await accessFor(ctx, user);
  if (need === "manage" ? !access.canManage : !access.canRecordApologies) {
    throw new Error(
      need === "manage"
        ? "Only officers can take the roll"
        : "Only officers or the Duty Officer can record apologies"
    );
  }
  return { userId, access };
}

export const getAccess = query({
  args: {},
  returns: v.object({ canManage: v.boolean(), canRecordApologies: v.boolean() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    if (!user) return { canManage: false, canRecordApologies: false };
    return await accessFor(ctx, user);
  },
});

// ─── The roster ────────────────────────────────────────────────────────────

const rosterEntryValidator = v.object({
  // Stable React key: the roll member id, or "u:<userId>" for an account not on the list yet
  key: v.string(),
  rollMemberId: v.union(v.id("rollMembers"), v.null()),
  userId: v.union(v.id("users"), v.null()),
  firstName: v.string(),
  lastName: v.string(),
  memberNumber: v.union(v.string(), v.null()),
  rank: v.union(rankValidator, v.null()),
  lieutenantNumber: v.union(v.number(), v.null()),
  hasAccount: v.boolean(),
  isActive: v.boolean(),
});

type RosterEntry = {
  key: string;
  rollMemberId: Id<"rollMembers"> | null;
  userId: Id<"users"> | null;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
  rank: Rank | null;
  lieutenantNumber: number | null;
  hasAccount: boolean;
  isActive: boolean;
};

function namesOf(user: Doc<"users">) {
  if (user.firstName || user.lastName) {
    return { firstName: user.firstName ?? "", lastName: user.lastName ?? "" };
  }
  const parts = (user.name ?? "").trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

const normaliseCfaId = (value: string | undefined) => value?.replace(/\s+/g, "") || undefined;

/**
 * Everyone the roll knows about, most senior first: every roll member, plus
 * every member account that isn't on the list yet. An unlinked roll member
 * whose CFA ID matches an account is treated as that account - the link is
 * written the first time either is marked.
 */
async function rollRoster(ctx: QueryCtx | MutationCtx): Promise<RosterEntry[]> {
  const [rollMembers, users] = await Promise.all([
    ctx.db.query("rollMembers").collect(),
    ctx.db.query("users").collect(),
  ]);
  const accounts = users.filter((user) => isMemberAccount(user));
  const usersById = new Map(users.map((user) => [user._id, user]));

  const linkedUserIds = new Set(rollMembers.flatMap((m) => (m.userId ? [m.userId] : [])));
  const unlinkedByCfaId = new Map<string, Doc<"rollMembers">>();
  for (const member of rollMembers) {
    const cfaId = normaliseCfaId(member.memberNumber);
    if (!member.userId && cfaId) unlinkedByCfaId.set(cfaId, member);
  }

  // Roll members that will pick up an account by CFA ID
  const pendingLinks = new Map<Id<"rollMembers">, Doc<"users">>();
  const entries: RosterEntry[] = [];

  for (const account of accounts) {
    if (linkedUserIds.has(account._id)) continue;
    const match = unlinkedByCfaId.get(normaliseCfaId(account.memberNumber) ?? "");
    if (match) {
      pendingLinks.set(match._id, account);
      continue;
    }
    if (account.isDisabled) continue;
    entries.push({
      key: `u:${account._id}`,
      rollMemberId: null,
      userId: account._id,
      ...namesOf(account),
      memberNumber: account.memberNumber ?? null,
      rank: account.rank ?? null,
      lieutenantNumber: account.lieutenantNumber ?? null,
      hasAccount: true,
      isActive: true,
    });
  }

  for (const member of rollMembers) {
    const user = member.userId ? usersById.get(member.userId) : pendingLinks.get(member._id);
    entries.push({
      key: member._id,
      rollMemberId: member._id,
      userId: user?._id ?? null,
      ...(user ? namesOf(user) : { firstName: member.firstName, lastName: member.lastName }),
      memberNumber: (user?.memberNumber ?? member.memberNumber) || null,
      rank: (user ? user.rank : member.rank) ?? null,
      lieutenantNumber: (user ? user.lieutenantNumber : member.lieutenantNumber) ?? null,
      hasAccount: !!user,
      // A disabled account has left the brigade
      isActive: member.isActive && !user?.isDisabled,
    });
  }

  return entries.sort((a, b) =>
    compareBySeniority(
      { ...a, rank: a.rank ?? undefined, lieutenantNumber: a.lieutenantNumber ?? undefined },
      { ...b, rank: b.rank ?? undefined, lieutenantNumber: b.lieutenantNumber ?? undefined }
    )
  );
}

/**
 * The roll member row for `who`, creating it for an account that isn't on the
 * list yet - linking it to a CFA ID match if an officer added them by hand.
 */
async function resolveRollMember(
  ctx: MutationCtx,
  who: { rollMemberId: Id<"rollMembers"> } | { userId: Id<"users"> },
  actorId: Id<"users">
): Promise<Id<"rollMembers">> {
  if ("rollMemberId" in who) {
    const member = await ctx.db.get(who.rollMemberId);
    if (!member) throw new Error("Roll member not found");
    if (!member.userId) await linkByCfaId(ctx, member);
    return member._id;
  }

  const existing = await ctx.db
    .query("rollMembers")
    .withIndex("by_userId", (q) => q.eq("userId", who.userId))
    .first();
  if (existing) return existing._id;

  const user = await ctx.db.get(who.userId);
  if (!user || !isMemberAccount(user)) throw new Error("Member not found");

  const cfaId = normaliseCfaId(user.memberNumber);
  if (cfaId) {
    const match = (
      await ctx.db
        .query("rollMembers")
        .withIndex("by_memberNumber", (q) => q.eq("memberNumber", cfaId))
        .collect()
    ).find((m) => !m.userId);
    if (match) {
      await ctx.db.patch(match._id, { userId: user._id, updatedAt: Date.now() });
      return match._id;
    }
  }

  const now = Date.now();
  return await ctx.db.insert("rollMembers", {
    userId: user._id,
    ...namesOf(user),
    memberNumber: cfaId,
    isActive: true,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  });
}

// Link an unlinked roll member to the account with its CFA ID, if one exists
async function linkByCfaId(ctx: MutationCtx, member: Doc<"rollMembers">) {
  const cfaId = normaliseCfaId(member.memberNumber);
  if (!cfaId) return;
  const account = (
    await ctx.db
      .query("users")
      .withIndex("by_memberNumber", (q) => q.eq("memberNumber", cfaId))
      .collect()
  ).find((user) => isMemberAccount(user));
  if (!account) return;
  const taken = await ctx.db
    .query("rollMembers")
    .withIndex("by_userId", (q) => q.eq("userId", account._id))
    .first();
  if (!taken) await ctx.db.patch(member._id, { userId: account._id, updatedAt: Date.now() });
}

export const getRoster = query({
  args: {},
  returns: v.array(rosterEntryValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    if (!user || !(await accessFor(ctx, user)).canManage) return [];
    return await rollRoster(ctx);
  },
});

// ─── Nights ────────────────────────────────────────────────────────────────

const nightSummaryValidator = v.object({
  date: v.string(),
  kind: nightKindValidator,
  title: v.union(v.string(), v.null()),
  status: nightStatusValidator,
  present: v.number(),
  apology: v.number(),
  absent: v.number(),
});

function nightFor(date: string, row: Doc<"rollNights"> | null) {
  return {
    date,
    kind: row?.kind ?? tuesdayKind(date),
    title: row?.title ?? null,
    status: row?.status ?? ("open" as const),
  };
}

async function nightRow(ctx: QueryCtx | MutationCtx, date: string) {
  return await ctx.db
    .query("rollNights")
    .withIndex("by_date", (q) => q.eq("date", date))
    .first();
}

/** The stored night for a date, creating a regular Tuesday on first touch. */
async function ensureNight(ctx: MutationCtx, date: string, actorId: Id<"users">) {
  const existing = await nightRow(ctx, date);
  if (existing) return existing;
  if (!isTuesday(date)) throw new Error("There's no roll on that date");
  const nightId = await ctx.db.insert("rollNights", {
    date,
    kind: tuesdayKind(date),
    status: "open",
    createdBy: actorId,
    createdAt: Date.now(),
  });
  return (await ctx.db.get(nightId))!;
}

async function marksFor(ctx: QueryCtx | MutationCtx, nightId: Id<"rollNights">) {
  return await ctx.db
    .query("rollMarks")
    .withIndex("by_nightId", (q) => q.eq("nightId", nightId))
    .collect();
}

/**
 * Roll nights between two dates: every Tuesday, plus any one-off night. `from`
 * and `to` come from the client so the query never reads the clock.
 */
export const listNights = query({
  args: { from: v.string(), to: v.string() },
  returns: v.array(nightSummaryValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    if (!user || !(await accessFor(ctx, user)).canRecordApologies) return [];

    const rows = await ctx.db
      .query("rollNights")
      .withIndex("by_date", (q) => q.gte("date", args.from).lte("date", args.to))
      .collect();
    const rowsByDate = new Map(rows.map((row) => [row.date, row]));
    const dates = new Set([...tuesdaysBetween(args.from, args.to), ...rowsByDate.keys()]);

    const nights = [];
    for (const date of [...dates].sort()) {
      const row = rowsByDate.get(date) ?? null;
      const counts = { present: 0, apology: 0, absent: 0 };
      if (row) {
        for (const mark of await marksFor(ctx, row._id)) counts[mark.status]++;
      }
      nights.push({ ...nightFor(date, row), ...counts });
    }
    return nights;
  },
});

const nameValidator = v.object({ firstName: v.string(), lastName: v.string() });

/**
 * One night's roll: the night, and every member on it with their mark. Members
 * made inactive since still appear on a night they were marked for.
 */
export const getNight = query({
  args: { date: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      night: v.object({
        date: v.string(),
        kind: nightKindValidator,
        title: v.union(v.string(), v.null()),
        status: nightStatusValidator,
        closedBy: v.union(nameValidator, v.null()),
        closedAt: v.union(v.number(), v.null()),
      }),
      canManage: v.boolean(),
      members: v.array(
        v.object({
          member: rosterEntryValidator,
          mark: v.union(
            v.null(),
            v.object({
              status: markStatusValidator,
              recordedBy: v.union(nameValidator, v.null()),
              recordedAt: v.number(),
            })
          ),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    if (!user) return null;
    const access = await accessFor(ctx, user);
    if (!access.canRecordApologies) return null;

    const row = await nightRow(ctx, args.date);
    if (!row && !isTuesday(args.date)) return null;

    const nameOf = async (id: Id<"users"> | undefined) => {
      const person = id ? await ctx.db.get(id) : null;
      return person ? namesOf(person) : null;
    };

    const marks = row ? await marksFor(ctx, row._id) : [];
    const marksByMember = new Map(marks.map((mark) => [mark.rollMemberId, mark]));
    const roster = await rollRoster(ctx);

    const members = [];
    for (const entry of roster) {
      const mark = entry.rollMemberId ? marksByMember.get(entry.rollMemberId) : undefined;
      if (!entry.isActive && !mark) continue;
      members.push({
        member: entry,
        mark: mark
          ? {
              status: mark.status,
              recordedBy: await nameOf(mark.recordedBy),
              recordedAt: mark.recordedAt,
            }
          : null,
      });
    }

    return {
      night: {
        ...nightFor(args.date, row),
        closedBy: await nameOf(row?.closedBy),
        closedAt: row?.closedAt ?? null,
      },
      canManage: access.canManage,
      members,
    };
  },
});

/**
 * Mark one member for one night, or clear their mark (null).
 *
 * The Duty Officer may only record or withdraw apologies; everything else is
 * the roll-taker's. Once a roll is closed nobody is left unmarked, so clearing
 * a mark on a closed night makes it Absent. Every change is kept in history.
 */
export const setMark = mutation({
  args: {
    date: v.string(),
    who: whoValidator,
    status: v.union(markStatusValidator, v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, access } = await requireAccess(ctx, "apologies");
    const night = await ensureNight(ctx, args.date, userId);
    if (night.status === "cancelled") throw new Error("This roll was cancelled");

    const rollMemberId = await resolveRollMember(ctx, args.who, userId);
    const existing = await ctx.db
      .query("rollMarks")
      .withIndex("by_nightId_and_rollMemberId", (q) =>
        q.eq("nightId", night._id).eq("rollMemberId", rollMemberId)
      )
      .first();

    let status: MarkStatus | null = args.status;
    if (status === null && night.status === "closed") status = "absent";

    if (!access.canManage) {
      const apologyOnly =
        night.status === "open" &&
        ((status === "apology" && (!existing || existing.status === "absent")) ||
          (status === null && existing?.status === "apology"));
      if (!apologyOnly) throw new Error("The Duty Officer can only record apologies");
    }

    const oldStatus = existing?.status;
    if (oldStatus === (status ?? undefined)) return null;

    const now = Date.now();
    if (status === null) {
      await ctx.db.delete(existing!._id);
    } else if (existing) {
      await ctx.db.patch(existing._id, { status, recordedBy: userId, recordedAt: now });
    } else {
      await ctx.db.insert("rollMarks", {
        nightId: night._id,
        rollMemberId,
        status,
        recordedBy: userId,
        recordedAt: now,
      });
    }

    await ctx.db.insert("rollMarkHistory", {
      nightId: night._id,
      rollMemberId,
      oldStatus,
      newStatus: status ?? undefined,
      changedBy: userId,
      changedAt: now,
    });
    return null;
  },
});

/** Close the roll: everyone still unmarked becomes Absent. Returns how many. */
export const closeRoll = mutation({
  args: { date: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { userId } = await requireAccess(ctx, "manage");
    const night = await ensureNight(ctx, args.date, userId);
    if (night.status !== "open") throw new Error("This roll isn't open");

    const marked = new Set((await marksFor(ctx, night._id)).map((mark) => mark.rollMemberId));
    const now = Date.now();
    let absent = 0;
    for (const entry of await rollRoster(ctx)) {
      if (!entry.isActive) continue;
      if (entry.rollMemberId && marked.has(entry.rollMemberId)) continue;
      const rollMemberId = await resolveRollMember(
        ctx,
        entry.rollMemberId ? { rollMemberId: entry.rollMemberId } : { userId: entry.userId! },
        userId
      );
      if (marked.has(rollMemberId)) continue;
      await ctx.db.insert("rollMarks", {
        nightId: night._id,
        rollMemberId,
        status: "absent",
        recordedBy: userId,
        recordedAt: now,
      });
      absent++;
    }

    await ctx.db.patch(night._id, { status: "closed", closedBy: userId, closedAt: now });
    return absent;
  },
});

/** Cancel a night (or bring it back). A closed roll can't be cancelled. */
export const setNightCancelled = mutation({
  args: { date: v.string(), cancelled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireAccess(ctx, "manage");
    const night = await ensureNight(ctx, args.date, userId);
    if (night.status === "closed") throw new Error("This roll is already closed");
    await ctx.db.patch(night._id, { status: args.cancelled ? "cancelled" : "open" });
    return null;
  },
});

/** Add a one-off roll night on a date that isn't a regular Tuesday. */
export const addNight = mutation({
  args: { date: v.string(), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireAccess(ctx, "manage");
    const title = args.title.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("Choose a date");
    if (!title) throw new Error("Give the roll a name");
    if (isTuesday(args.date) || (await nightRow(ctx, args.date))) {
      throw new Error("There's already a roll on that date");
    }
    await ctx.db.insert("rollNights", {
      date: args.date,
      kind: "other",
      title,
      status: "open",
      createdBy: userId,
      createdAt: Date.now(),
    });
    return null;
  },
});

// ─── Roll members ──────────────────────────────────────────────────────────

const memberFields = {
  firstName: v.string(),
  lastName: v.string(),
  memberNumber: v.optional(v.string()),
  rank: v.optional(rankValidator),
  lieutenantNumber: v.optional(v.number()),
};

function cleanMember(args: {
  firstName: string;
  lastName: string;
  memberNumber?: string;
  rank?: Rank;
  lieutenantNumber?: number;
}) {
  const firstName = args.firstName.trim();
  const lastName = args.lastName.trim();
  if (!firstName || !lastName) throw new Error("First and last name are required");
  const lieutenantNumber = args.rank === "Lieutenant" ? args.lieutenantNumber : undefined;
  if (lieutenantNumber !== undefined && !isValidLieutenantNumber(lieutenantNumber)) {
    throw new Error("Lieutenant number must be 1st to 5th");
  }
  return {
    firstName,
    lastName,
    memberNumber: normaliseCfaId(args.memberNumber),
    rank: args.rank,
    lieutenantNumber,
  };
}

async function assertCfaIdFree(
  ctx: MutationCtx,
  cfaId: string | undefined,
  except?: Id<"rollMembers">
) {
  if (!cfaId) return;
  const clash = (
    await ctx.db
      .query("rollMembers")
      .withIndex("by_memberNumber", (q) => q.eq("memberNumber", cfaId))
      .collect()
  ).find((member) => member._id !== except);
  if (clash) {
    throw new Error(`${clash.firstName} ${clash.lastName} is already on the roll with that CFA ID`);
  }
}

/**
 * Add someone to the roll by hand - a member without a BRAVO account. If their
 * CFA ID belongs to an account, they're linked to it straight away.
 */
export const addRollMember = mutation({
  args: memberFields,
  returns: v.id("rollMembers"),
  handler: async (ctx, args) => {
    const { userId } = await requireAccess(ctx, "manage");
    const member = cleanMember(args);
    await assertCfaIdFree(ctx, member.memberNumber);

    const now = Date.now();
    const rollMemberId = await ctx.db.insert("rollMembers", {
      ...member,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await linkByCfaId(ctx, (await ctx.db.get(rollMemberId))!);
    return rollMemberId;
  },
});

/** Edit a roll member's own details. A linked member's come from their account. */
export const updateRollMember = mutation({
  args: { rollMemberId: v.id("rollMembers"), ...memberFields },
  returns: v.null(),
  handler: async (ctx, { rollMemberId, ...fields }) => {
    await requireAccess(ctx, "manage");
    const existing = await ctx.db.get(rollMemberId);
    if (!existing) throw new Error("Roll member not found");
    if (existing.userId) {
      throw new Error("This member has a BRAVO account - change their details in User Management");
    }
    const member = cleanMember(fields);
    await assertCfaIdFree(ctx, member.memberNumber, rollMemberId);
    await ctx.db.patch(rollMemberId, { ...member, updatedAt: Date.now() });
    await linkByCfaId(ctx, (await ctx.db.get(rollMemberId))!);
    return null;
  },
});

/** Take someone off future rolls (left the brigade), or put them back. */
export const setRollMemberActive = mutation({
  args: { who: whoValidator, isActive: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireAccess(ctx, "manage");
    const rollMemberId = await resolveRollMember(ctx, args.who, userId);
    await ctx.db.patch(rollMemberId, { isActive: args.isActive, updatedAt: Date.now() });
    return null;
  },
});

/**
 * Link a hand-added roll member to a BRAVO account (or unlink, with null), for
 * when the CFA IDs didn't match. Their roll history stays with them.
 */
export const linkRollMember = mutation({
  args: { rollMemberId: v.id("rollMembers"), userId: v.union(v.id("users"), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAccess(ctx, "manage");
    const member = await ctx.db.get(args.rollMemberId);
    if (!member) throw new Error("Roll member not found");

    if (args.userId === null) {
      await ctx.db.patch(member._id, { userId: undefined, updatedAt: Date.now() });
      return null;
    }

    const user = await ctx.db.get(args.userId);
    if (!user || !isMemberAccount(user)) throw new Error("Member not found");
    const taken = await ctx.db
      .query("rollMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId!))
      .first();
    if (taken && taken._id !== member._id) {
      throw new Error(
        `That account already has its own roll history as ${taken.firstName} ${taken.lastName}`
      );
    }
    await ctx.db.patch(member._id, {
      userId: user._id,
      // Keep the hand-entered name as the fallback if the account is ever unlinked
      updatedAt: Date.now(),
    });
    return null;
  },
});

// ─── Report ────────────────────────────────────────────────────────────────

/**
 * Attendance per member across the closed rolls in a date range. Only closed
 * rolls count - an open one is still being taken.
 */
export const getReport = query({
  args: {
    from: v.string(),
    to: v.string(),
    kind: v.union(v.literal("all"), v.literal("training"), v.literal("meeting")),
  },
  returns: v.object({
    nights: v.array(v.object({ date: v.string(), kind: nightKindValidator, title: v.union(v.string(), v.null()) })),
    rows: v.array(
      v.object({
        member: rosterEntryValidator,
        present: v.number(),
        apology: v.number(),
        absent: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    if (!user || !(await accessFor(ctx, user)).canManage) return { nights: [], rows: [] };

    const nights = (
      await ctx.db
        .query("rollNights")
        .withIndex("by_date", (q) => q.gte("date", args.from).lte("date", args.to))
        .collect()
    ).filter(
      (night) =>
        night.status === "closed" &&
        (args.kind === "all" || night.kind === args.kind)
    );

    const tally = new Map<Id<"rollMembers">, Record<MarkStatus, number>>();
    for (const night of nights) {
      for (const mark of await marksFor(ctx, night._id)) {
        const counts = tally.get(mark.rollMemberId) ?? { present: 0, apology: 0, absent: 0 };
        counts[mark.status]++;
        tally.set(mark.rollMemberId, counts);
      }
    }

    const rows = [];
    for (const entry of await rollRoster(ctx)) {
      const counts = entry.rollMemberId ? tally.get(entry.rollMemberId) : undefined;
      if (!counts) continue;
      rows.push({ member: entry, ...counts });
    }

    return {
      nights: nights.map((night) => ({
        date: night.date,
        kind: night.kind,
        title: night.title ?? null,
      })),
      rows,
    };
  },
});
