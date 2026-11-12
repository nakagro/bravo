import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { attendanceFor } from "../events";
import { displayName, seatLines } from "./crewSeats";
import { MAX_APPLIANCES_PER_EVENT } from "./eventCrews";
import { eventIsOver, eventValues } from "./assignments/eventSource";
import { loadModuleMap, loadTemplates, loadUsers, unreachableReason } from "./notificationDelivery";
import { fingerprintOf, renderTemplate } from "./notificationTemplates";
import { upsertNotice } from "./notifyEvent";

// Event change notices: "Cancelled: Open day", "Changed: …", "Back on: …".
// One text for everyone involved, sent only when the person making the change
// leaves the box ticked or taps Send. Built on the shared templates, renderer,
// delivery and fingerprint check; not on the assignment adapter, since there's
// no per-member diff here.

export type ChangeKind = "cancelled" | "detailsChanged" | "restored";
export type InvolvedReason = "rostered" | "going" | "maybe" | "offered";

export const CHANGE_NOTICE_KEY = "events:changeNotice";

/**
 * Who is involved in an event, and why. Wider than the roster on purpose:
 * - anyone on the roster or seated on an appliance, whatever they answered;
 * - while responses are open, members who answered yes or maybe and members
 *   who offered for a shift;
 * - never a "can't make it", unless they're rostered or seated.
 * When responses are closed the organiser owns the list, so an old yes that
 * was never rostered isn't counted (the rule attendanceFor applies).
 */
export async function involvedMembers(
  ctx: QueryCtx,
  event: Doc<"events">,
): Promise<Map<Id<"users">, InvolvedReason>> {
  const { rostered, declined, rsvps } = await attendanceFor(ctx, event);
  const involved = new Map<Id<"users">, InvolvedReason>();
  for (const id of rostered) involved.set(id, "rostered");

  const crews = await ctx.db
    .query("eventCrews")
    .withIndex("by_event", (q) => q.eq("eventId", event._id))
    .take(MAX_APPLIANCES_PER_EVENT * 2);
  for (const crew of crews) {
    for (const m of seatLines(crew).members) involved.set(m.userId, "rostered");
  }

  if ((event.memberResponses ?? "open") !== "closed") {
    const add = (id: Id<"users">, reason: InvolvedReason) => {
      if (!involved.has(id) && !declined.has(id)) involved.set(id, reason);
    };
    for (const r of rsvps) if (r.status === "attending") add(r.userId, "going");
    if (event.hasShifts) {
      const offers = await ctx.db
        .query("eventSlotResponses")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();
      for (const o of offers) add(o.userId, "offered");
    }
    for (const r of rsvps) if (r.status === "maybe") add(r.userId, "maybe");
  }
  return involved;
}

export async function changeNoticeRow(ctx: QueryCtx, eventId: Id<"events">) {
  return await ctx.db
    .query("actionNotices")
    .withIndex("by_source", (q) => q.eq("conditionKey", CHANGE_NOTICE_KEY).eq("sourceEntityId", eventId))
    .first();
}

/** Whether *this* cancellation (not an earlier one, before a restore) was sent. */
export function cancellationAnnounced(event: Doc<"events">, row: Doc<"actionNotices"> | null): boolean {
  return (
    event.status === "cancelled" &&
    !!row &&
    row.kind === "cancelled" &&
    row.createdAt >= (event.cancelledAt ?? Infinity)
  );
}

/**
 * Whether a notice of this kind can go out now. `pending` is the change the
 * same call is about to make (cancelEvent/restoreEvent), so cancel can be
 * previewed while the event is still active.
 */
function kindApplies(
  event: Doc<"events">,
  row: Doc<"actionNotices"> | null,
  kind: ChangeKind,
  pending: boolean,
): boolean {
  if (eventIsOver(event)) return false;
  if (kind === "detailsChanged") return event.status === "active";
  if (kind === "cancelled") {
    return pending ? event.status === "active" : event.status === "cancelled" && !cancellationAnnounced(event, row);
  }
  return event.status === "cancelled" && cancellationAnnounced(event, row);
}

export type ChangePreview = {
  title: string;
  body: string;
  recipients: { userId: Id<"users">; name: string; reason: InvolvedReason | "told" }[];
  counts: Record<InvolvedReason | "told", number>;
  cantNotify: number;
  fingerprint: string;
};

export async function buildChangePreview(
  ctx: QueryCtx,
  event: Doc<"events">,
  senderId: Id<"users">,
  kind: ChangeKind,
  message: string,
  pending: boolean,
): Promise<ChangePreview | null> {
  const row = await changeNoticeRow(ctx, event._id);
  if (!kindApplies(event, row, kind, pending)) return null;

  // "Back on" goes to whoever was told it was off, even if the roster changed since.
  const audience: Map<Id<"users">, InvolvedReason | "told"> =
    kind === "restored"
      ? new Map(row!.recipientUserIds.map((id) => [id, "told" as const]))
      : await involvedMembers(ctx, event);
  // The sender made the change, so isn't told about it.
  audience.delete(senderId);

  const users = await loadUsers(ctx, [senderId, ...audience.keys()]);
  const moduleMap = await loadModuleMap(ctx);
  const recipients: ChangePreview["recipients"] = [];
  const counts = { rostered: 0, going: 0, maybe: 0, offered: 0, told: 0 };
  let cantNotify = 0;
  for (const [userId, reason] of audience) {
    const user = users.get(userId) ?? null;
    if (unreachableReason(user, moduleMap, "events")) {
      cantNotify++;
      continue;
    }
    recipients.push({ userId, name: displayName(user), reason });
    counts[reason]++;
  }
  recipients.sort((a, b) => a.name.localeCompare(b.name));

  const template = await loadTemplates(ctx);
  const rendered = renderTemplate(template(`event.${kind}`), {
    ...eventValues(event),
    message,
    sender: displayName(users.get(senderId)),
  });

  const fingerprint = fingerprintOf([
    kind,
    rendered.title,
    rendered.body,
    ...recipients.map((r) => r.userId).sort(),
  ]);
  return { ...rendered, recipients, counts, cantNotify, fingerprint };
}

const SUMMARY: Record<ChangeKind, string> = {
  cancelled: "Cancellation",
  detailsChanged: "Change notice",
  restored: "Back-on notice",
};

/** Write the Action Centre row, the audit entry, and schedule the push. */
export async function applyChangeNotice(
  ctx: MutationCtx,
  event: Doc<"events">,
  senderId: Id<"users">,
  kind: ChangeKind,
  preview: ChangePreview,
) {
  const now = Date.now();
  const url = `/events/${event._id}`;
  const recipientUserIds = preview.recipients.map((r) => r.userId);
  // One row per event: "Back on" replaces "Cancelled" rather than stacking.
  await upsertNotice(ctx, {
    moduleId: "events",
    conditionKey: CHANGE_NOTICE_KEY,
    title: preview.title,
    description: preview.body,
    url,
    priority: kind === "cancelled" ? "high" : "medium",
    recipientUserIds,
    sourceEntityId: event._id,
    kind,
    createdAt: now,
    createdBy: senderId,
  });

  const n = recipientUserIds.length;
  await ctx.db.insert("eventHistory", {
    eventId: event._id,
    timestamp: now,
    userId: senderId,
    changeType: "notification_sent",
    field: "notification",
    oldValue: null,
    newValue: "sent",
    notes: `${SUMMARY[kind]} sent to ${n} member${n === 1 ? "" : "s"}`,
  });

  if (n > 0) {
    await ctx.scheduler.runAfter(0, internal.pushNotificationAction.deliverToUsers, {
      messages: recipientUserIds.map((userId) => ({ userId, title: preview.title, body: preview.body, url })),
      notificationType: "eventChange",
      source: `events:${kind}`,
    });
  }
}
