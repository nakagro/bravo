import { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { RANK_ORDER } from "../modules";
import { isMemberAccount } from "./accountType";

/**
 * Shared "something happened, tell the people responsible" plumbing.
 *
 * Modules report an event; who hears about it and how is configuration, held in
 * `actionAccountability` and edited by officers in the admin UI. A module never
 * names a recipient in code — that mapping changes every time a portfolio
 * changes hands, and code changes shouldn't.
 *
 * Delivery is in-app (an `actionNotices` row surfaced by `noticesProvider`) plus
 * optional email. Both are best-effort: an unmapped or disabled key is silent,
 * never a broadcast.
 */

export type EventDetail = { label: string; value: string };

export type NotifyEventArgs = {
  /** Module the notice belongs to; gates visibility the same way as any action. */
  moduleId: string;
  /** Audience key in `actionAccountability`, conventionally "module:event". */
  conditionKey: string;
  title: string;
  description?: string;
  /** Where the notice links to in the app. */
  url: string;
  priority?: "low" | "medium" | "high";
  /** Stable id of the subject, so repeats update rather than stack. */
  sourceEntityId?: string;
  /** Whoever triggered the event — never notified about their own action. */
  actorUserId?: Id<"users">;
  /** Email-only extras. The in-app card stays terse; the email can carry detail. */
  emailSubject?: string;
  emailIntro?: string;
  emailDetails?: EventDetail[];
  /** A heading plus lines, used for "these need attention" lists. */
  emailListTitle?: string;
  emailList?: string[];
  /**
   * Bypass audience resolution and deliver to exactly these users. Only for
   * admin-triggered test sends, which must reach the person pressing the
   * button — the normal path deliberately excludes the actor, so a test would
   * otherwise skip the one person waiting to see it.
   */
  overrideRecipients?: Id<"users">[];
};

/**
 * Resolve a condition key to the users accountable for it. Role, explicit user
 * and rank floor are ORed — any one of them makes you accountable. Returns an
 * empty array when the key is unmapped or switched off.
 */
export async function resolveAudience(
  ctx: QueryCtx | MutationCtx,
  conditionKey: string
): Promise<{ mapping: Doc<"actionAccountability"> | null; userIds: Id<"users">[] }> {
  const mapping = await ctx.db
    .query("actionAccountability")
    .withIndex("by_conditionKey", (q) => q.eq("conditionKey", conditionKey))
    .first();

  if (!mapping || !mapping.isEnabled) return { mapping: null, userIds: [] };

  const hasRoleReq = mapping.roles.length > 0;
  const hasRankReq = !!mapping.minimumRank;
  const rankFloor = mapping.minimumRank ? (RANK_ORDER[mapping.minimumRank] ?? 0) : 0;

  // Named users are taken as given; role/rank matching needs the member list.
  const matched = new Set<Id<"users">>(mapping.userIds);

  if (hasRoleReq || hasRankReq) {
    // Roles are an array field, so there's no index to match on — the roster is
    // scanned, as it is everywhere else that resolves role holders. Capped well
    // above brigade size so this can't turn into an unbounded read.
    const users = await ctx.db.query("users").take(1000);
    for (const user of users) {
      if (!isMemberAccount(user)) continue;
      const roleOk =
        hasRoleReq && mapping.roles.some((r) => (user.roles ?? []).includes(r));
      const rankOk =
        hasRankReq && !!user.rank && (RANK_ORDER[user.rank] ?? 0) >= rankFloor;
      if (roleOk || rankOk) matched.add(user._id);
    }
  }

  return { mapping, userIds: [...matched] };
}

/**
 * Raise an event notice. Returns the notice id, or null when nobody is mapped
 * to the key (the common case until an officer configures it).
 */
export async function notifyEvent(
  ctx: MutationCtx,
  args: NotifyEventArgs
): Promise<Id<"actionNotices"> | null> {
  const { mapping, userIds } = await resolveAudience(ctx, args.conditionKey);
  if (!mapping) return null;

  const recipients =
    args.overrideRecipients ?? userIds.filter((id) => id !== args.actorUserId);
  if (recipients.length === 0) return null;

  const notifyInApp = mapping.notifyInApp !== false;
  const notifyEmail = mapping.notifyEmail === true;
  const now = Date.now();

  let noticeId: Id<"actionNotices"> | null = null;

  if (notifyInApp) {
    // A repeat of the same event replaces the earlier notice, and clears the
    // dismissals against it — the subject changed, so it's worth another look.
    const existing = args.sourceEntityId
      ? await ctx.db
          .query("actionNotices")
          .withIndex("by_source", (q) =>
            q.eq("conditionKey", args.conditionKey).eq("sourceEntityId", args.sourceEntityId)
          )
          .first()
      : null;

    const fields = {
      moduleId: args.moduleId,
      conditionKey: args.conditionKey,
      title: args.title,
      description: args.description,
      url: args.url,
      priority: args.priority ?? "medium",
      recipientUserIds: recipients,
      sourceEntityId: args.sourceEntityId,
      createdAt: now,
      createdBy: args.actorUserId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      const stale = await ctx.db
        .query("actionDismissals")
        .withIndex("by_action", (q) => q.eq("actionId", noticeActionId(existing._id)))
        .collect();
      for (const row of stale) await ctx.db.delete(row._id);
      noticeId = existing._id;
    } else {
      noticeId = await ctx.db.insert("actionNotices", fields);
    }
  }

  if (notifyEmail) {
    const emails: string[] = [];
    for (const userId of recipients) {
      const user = await ctx.db.get(userId);
      if (user?.email) emails.push(user.email);
    }

    if (emails.length > 0) {
      await ctx.scheduler.runAfter(0, internal.emails.sendEventNoticeEmail, {
        to: emails,
        subject: args.emailSubject ?? args.title,
        heading: args.title,
        intro: args.emailIntro ?? args.description,
        details: args.emailDetails ?? [],
        listTitle: args.emailListTitle,
        list: args.emailList ?? [],
        url: args.url,
      });
    }
  }

  return noticeId;
}

/** The Action Centre id for a stored notice — also its dismissal key. */
export function noticeActionId(noticeId: Id<"actionNotices">): string {
  return `notice:${noticeId}`;
}
