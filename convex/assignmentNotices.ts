import { query, mutation, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { displayName } from "./lib/crewSeats";
import {
  ASSIGNMENT_SOURCES,
  assignmentSourceValidator,
  type AssignmentSourceKey,
} from "./lib/assignments/sources";
import { canCrewDeployments, deploymentDayIsPast } from "./lib/assignments/deploymentSource";
import {
  loadModuleMap,
  loadTemplates,
  loadUsers,
  logNoticeSend,
  pushStateFor,
  unreachableReason,
  type PushState,
} from "./lib/notificationDelivery";
import {
  NOTE_MAX,
  fingerprintOf,
  joinAssignment,
  renderTemplate,
  sameLines,
  type TemplateKey,
} from "./lib/notificationTemplates";

// Assignment notices: "you're on Tanker 1 as Driver", sent by the person doing
// the crewing when they're done. Saving a crew or roster never notifies anyone;
// members are told only when the sender confirms a send from
// SendAssignmentsSheet. The confirm screen shows the text this file renders,
// and the send re-renders it and refuses if anything moved in between.

type State = "new" | "changed" | "unchanged" | "removed";

const audienceValidator = v.union(v.literal("changes"), v.literal("everyone"));
type Audience = "changes" | "everyone";

const recipientValidator = v.object({
  userId: v.id("users"),
  name: v.string(),
  state: v.union(v.literal("new"), v.literal("changed"), v.literal("unchanged"), v.literal("removed")),
  lines: v.array(v.string()),
  previousLines: v.array(v.string()),
  title: v.string(),
  body: v.string(),
  push: v.union(v.literal("on"), v.literal("muted"), v.literal("noDevice")),
});

const previewValidator = v.object({
  recipients: v.array(recipientValidator),
  unchangedCount: v.number(),
  notNotified: v.array(v.object({ name: v.string(), reason: v.string() })),
  pendingCount: v.number(),
  fingerprint: v.string(),
});

type Recipient = {
  userId: Id<"users">;
  name: string;
  state: State;
  lines: string[];
  previousLines: string[];
  title: string;
  body: string;
  push: PushState;
};

export function cleanNote(message: string | undefined) {
  const note = message?.trim() ?? "";
  if (note.length > NOTE_MAX) throw new Error(`Keep the note to ${NOTE_MAX} characters or fewer`);
  return note;
}

/**
 * Preview and send share this helper (not a ctx.runQuery hop), so what the
 * confirm screen shows and what the send writes can't drift apart.
 */
async function buildAssignmentPreview(
  ctx: QueryCtx,
  args: { source: AssignmentSourceKey; scopeId: string; audience: Audience; message?: string },
) {
  const source = ASSIGNMENT_SOURCES[args.source];
  const senderId = await source.senderId(ctx, args.scopeId);
  if (!senderId) return null;
  const scope = await source.load(ctx, args.scopeId);
  if (!scope) return null;
  const note = cleanNote(args.message);

  const receipts = await ctx.db
    .query("assignmentReceipts")
    .withIndex("by_scope_user", (q) => q.eq("scopeKey", scope.scopeKey))
    .take(500);
  const receiptByUser = new Map(receipts.map((r) => [r.userId, r]));

  const users = await loadUsers(ctx, [
    senderId,
    ...scope.assignments.map((a) => a.userId),
    ...receipts.map((r) => r.userId),
  ]);
  const moduleMap = await loadModuleMap(ctx);
  const template = await loadTemplates(ctx);
  const senderName = displayName(users.get(senderId));

  type Candidate = {
    userId: Id<"users">;
    state: State;
    lines: string[];
    previousLines: string[];
    values?: Record<string, string>;
  };
  const candidates: Candidate[] = [];
  const held = new Set<Id<"users">>();
  for (const a of scope.assignments) {
    held.add(a.userId);
    const receipt = receiptByUser.get(a.userId);
    const state: State =
      !receipt || receipt.removed ? "new" : sameLines(receipt.lines, a.lines) ? "unchanged" : "changed";
    const previousLines = receipt && !receipt.removed ? receipt.lines : [];
    candidates.push({ userId: a.userId, state, lines: a.lines, previousLines, values: a.values });
  }
  // Told before and holding nothing now. Someone added and removed before any
  // send has no receipt, so hears nothing.
  for (const r of receipts) {
    if (held.has(r.userId) || r.removed) continue;
    candidates.push({ userId: r.userId, state: "removed", lines: [], previousLines: r.lines });
  }

  const notNotified = scope.externalNames.map((name) => ({ name, reason: "Not a BRAVO member" }));
  const recipients: Recipient[] = [];
  let unchangedCount = 0;
  let pendingCount = 0;

  for (const c of candidates) {
    const user = users.get(c.userId) ?? null;
    const unreachable = unreachableReason(user, moduleMap, scope.moduleId);
    if (unreachable) {
      notNotified.push({ name: displayName(user), reason: unreachable });
      continue;
    }
    if (c.state === "unchanged") unchangedCount++;
    else pendingCount++;
    if (c.state === "unchanged" && args.audience === "changes") continue;

    // "Everyone" re-sends `assigned` to the up-to-date: it's the reminder case.
    const kind = c.state === "changed" ? "updated" : c.state === "removed" ? "removed" : "assigned";
    const key = `${scope.templatePrefix}.${kind}` as TemplateKey;
    const shown = c.state === "removed" ? c.previousLines : c.lines;
    const rendered = renderTemplate(template(key), {
      ...scope.values,
      ...c.values,
      firstName: user!.firstName || displayName(user).split(" ")[0],
      assignment: joinAssignment(shown),
      message: note,
      sender: senderName,
    });
    recipients.push({
      userId: c.userId,
      name: displayName(user),
      state: c.state,
      lines: c.lines,
      previousLines: c.previousLines,
      ...rendered,
      push: await pushStateFor(ctx, user!, scope.notificationType),
    });
  }

  const order: Record<State, number> = { new: 0, changed: 1, removed: 2, unchanged: 3 };
  recipients.sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name));

  // Includes each recipient's state, so a double tap is refused even with
  // "Everyone", where the second send's text would be identical.
  const fingerprint = fingerprintOf(
    [...recipients]
      .sort((a, b) => (a.userId < b.userId ? -1 : 1))
      .flatMap((r) => [r.userId, r.state, r.title, r.body]),
  );

  return {
    senderId,
    scope,
    preview: { recipients, unchangedCount, notNotified, pendingCount, fingerprint },
  };
}

/**
 * What a send would do right now, with every recipient's exact text. Also
 * drives the "Send to crew" button, so it returns null (never throws) for a
 * member who can't send or a scope that's closed.
 */
export const previewAssignmentNotice = query({
  args: {
    source: assignmentSourceValidator,
    scopeId: v.string(),
    audience: audienceValidator,
    message: v.optional(v.string()),
  },
  returns: v.union(v.null(), previewValidator),
  handler: async (ctx, args) => {
    const built = await buildAssignmentPreview(ctx, args);
    return built ? built.preview : null;
  },
});

/**
 * Send what was confirmed. A mutation, not an action, so the fingerprint check
 * and the receipts commit together; the push is scheduled afterwards and is
 * best-effort, with the receipt doubling as the guaranteed Action Centre copy.
 */
export const sendAssignmentNotice = mutation({
  args: {
    source: assignmentSourceValidator,
    scopeId: v.string(),
    audience: audienceValidator,
    message: v.optional(v.string()),
    fingerprint: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const source = ASSIGNMENT_SOURCES[args.source];
    if (!(await source.senderId(ctx, args.scopeId))) {
      throw new Error("You can't send notices for this");
    }
    const built = await buildAssignmentPreview(ctx, args);
    if (!built) throw new Error("This can no longer be sent");
    const { senderId, scope, preview } = built;
    if (preview.fingerprint !== args.fingerprint) {
      throw new Error("The crew or message changed, check it again");
    }
    if (preview.recipients.length === 0) throw new Error("There's nobody to send to");

    const now = Date.now();
    for (const r of preview.recipients) {
      const fields = {
        scopeKey: scope.scopeKey,
        userId: r.userId,
        lines: r.state === "removed" ? r.previousLines : r.lines,
        removed: r.state === "removed" ? true : undefined,
        title: r.title,
        body: r.body,
        url: scope.url,
        moduleId: scope.moduleId,
        sentAt: now,
        sentBy: senderId,
      };
      const existing = await ctx.db
        .query("assignmentReceipts")
        .withIndex("by_scope_user", (q) => q.eq("scopeKey", scope.scopeKey).eq("userId", r.userId))
        .first();
      if (existing) await ctx.db.replace(existing._id, fields);
      else await ctx.db.insert("assignmentReceipts", fields);
    }

    const n = preview.recipients.length;
    await logNoticeSend(ctx, {
      scopeKey: scope.scopeKey,
      kind: "assignment",
      title: preview.recipients[0].title,
      message: args.message?.trim(),
      recipientCount: n,
      recipients: preview.recipients.map((r) => ({ userId: r.userId, state: r.state })),
      sentBy: senderId,
    });
    await source.recordSend?.(ctx, args.scopeId, senderId, `Crew notice sent to ${n} member${n === 1 ? "" : "s"}`);

    await ctx.scheduler.runAfter(0, internal.pushNotificationAction.deliverToUsers, {
      messages: preview.recipients.map((r) => ({ userId: r.userId, title: r.title, body: r.body, url: scope.url })),
      notificationType: scope.notificationType,
      source: `assignments:${args.source}`,
    });
    return n;
  },
});

/**
 * Deployment days in the window whose crews are all gone (deleted or moved)
 * but whose members were told, so CrewsView can still offer the "no longer
 * crewed" send. Crewing officers only.
 */
export const deploymentDaysWithReceiptsOnly = query({
  args: { startDate: v.number(), endDate: v.number() },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    if (!(await canCrewDeployments(ctx))) return [];
    const days: number[] = [];
    for (let day = args.startDate; day <= args.endDate && days.length < 31; day += 86_400_000) {
      if (deploymentDayIsPast(day)) continue;
      const crew = await ctx.db
        .query("deploymentCrews")
        .withIndex("by_date", (q) => q.eq("date", day))
        .first();
      if (crew) continue;
      const receipts = await ctx.db
        .query("assignmentReceipts")
        .withIndex("by_scope_user", (q) => q.eq("scopeKey", `deployment:${day}`))
        .take(100);
      if (receipts.some((r) => !r.removed)) days.push(day);
    }
    return days;
  },
});

/**
 * The running sheet: every targeted send for an event or deployment day,
 * newest first, one row per send. Visible to whoever may send for it.
 */
export const listNotificationSends = query({
  args: { source: assignmentSourceValidator, scopeId: v.string() },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        _id: v.id("notificationSends"),
        kind: v.string(),
        title: v.string(),
        message: v.optional(v.string()),
        recipientCount: v.number(),
        recipients: v.array(v.object({ name: v.string(), state: v.optional(v.string()) })),
        sentAt: v.number(),
        sentByName: v.string(),
      }),
    ),
  ),
  handler: async (ctx, args) => {
    if (!(await ASSIGNMENT_SOURCES[args.source].senderId(ctx, args.scopeId))) return null;
    const scopeKey =
      args.source === "event"
        ? `event:${args.scopeId}`
        : `deployment:${args.scopeId}`;
    const sends = await ctx.db
      .query("notificationSends")
      .withIndex("by_scope_sentAt", (q) => q.eq("scopeKey", scopeKey))
      .order("desc")
      .take(50);
    const users = await loadUsers(ctx, [
      ...sends.map((s) => s.sentBy),
      ...sends.flatMap((s) => s.recipients.map((r) => r.userId)),
    ]);
    return sends.map((s) => ({
      _id: s._id,
      kind: s.kind,
      title: s.title,
      message: s.message,
      recipientCount: s.recipientCount,
      recipients: s.recipients
        .map((r) => ({ name: displayName(users.get(r.userId)), state: r.state }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      sentAt: s.sentAt,
      sentByName: displayName(users.get(s.sentBy)),
    }));
  },
});
