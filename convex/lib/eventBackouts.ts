import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { displayName, seatLines } from "./crewSeats";
import { MAX_APPLIANCES_PER_EVENT } from "./eventCrews";
import { loadModuleMap, loadUsers, unreachableReason } from "./notificationDelivery";
import { upsertNotice } from "./notifyEvent";

// "Can't make it" after saying yes, for the people running the event.
//
// Built not to spam: one running Action Centre item per event (who backed out,
// and what they'd held), updated in place. Only a backout by someone the
// organiser was counting on - rostered or seated on an appliance - also
// pushes, and at most once per event every PUSH_GAP_MS. A plain yes/maybe/
// offer that turns into a no is in the list but never pushes. Changing back
// takes the member off the list.

export const BACKOUT_NOTICE_KEY = "events:backouts";
const PUSH_GAP_MS = 15 * 60 * 1000;

/** What a member held just before they declined, if anything worth reporting. */
export type PriorInvolvement = {
  rsvp?: "attending" | "maybe" | null;
  offeredShift?: boolean;
};

async function heldOnEvent(ctx: MutationCtx, eventId: Id<"events">, userId: Id<"users">) {
  const allocation = await ctx.db
    .query("eventSlotAllocations")
    .withIndex("by_event_user", (q) => q.eq("eventId", eventId).eq("userId", userId))
    .first();
  const crews = await ctx.db
    .query("eventCrews")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(MAX_APPLIANCES_PER_EVENT * 2);
  const crewed = crews.some((crew) => seatLines(crew).members.some((m) => m.userId === userId));
  return { rostered: !!allocation, crewed };
}

async function backoutRow(ctx: MutationCtx, eventId: Id<"events">) {
  return await ctx.db
    .query("actionNotices")
    .withIndex("by_source", (q) => q.eq("conditionKey", BACKOUT_NOTICE_KEY).eq("sourceEntityId", eventId))
    .first();
}

async function writeRow(
  ctx: MutationCtx,
  event: Doc<"events">,
  existing: Doc<"actionNotices"> | null,
  entries: { userId: Id<"users">; label: string }[],
  lastPushAt: number | undefined,
) {
  if (entries.length === 0) {
    if (existing) await ctx.db.delete(existing._id);
    return null;
  }
  const users = await loadUsers(ctx, entries.map((e) => e.userId));
  const description = entries
    .map((e) => `${displayName(users.get(e.userId))} (${e.label})`)
    .join(", ");
  const listed = new Set(entries.map((e) => e.userId));
  const recipients = [event.createdBy, ...(event.teamLeaderIds ?? [])].filter((id) => !listed.has(id));
  return {
    description,
    fields: {
      moduleId: "events",
      conditionKey: BACKOUT_NOTICE_KEY,
      title: `Can't make it: ${event.title}`,
      description,
      url: `/events/${event._id}`,
      priority: "medium" as const,
      recipientUserIds: [...new Set(recipients)],
      sourceEntityId: event._id,
      entries,
      lastPushAt,
      createdAt: Date.now(),
    },
  };
}

/**
 * Call when a member has just declined. `prior` is what they'd said before;
 * the roster and crew seats are read now (a decline doesn't remove them).
 */
export async function recordBackout(
  ctx: MutationCtx,
  event: Doc<"events">,
  userId: Id<"users">,
  prior: PriorInvolvement,
) {
  const { rostered, crewed } = await heldOnEvent(ctx, event._id, userId);
  const label = rostered && crewed
    ? "rostered and crewed"
    : rostered
      ? "rostered"
      : crewed
        ? "crewed"
        : prior.offeredShift
          ? "had offered for a shift"
          : prior.rsvp === "attending"
            ? "was a yes"
            : prior.rsvp === "maybe"
              ? "was a maybe"
              : null;
  if (!label) return; // no response → no: nothing they'd committed to

  const existing = await backoutRow(ctx, event._id);
  const entries = [...(existing?.entries ?? []).filter((e) => e.userId !== userId), { userId, label }];
  const committed = rostered || crewed;
  const now = Date.now();
  const pushNow = committed && (!existing?.lastPushAt || now - existing.lastPushAt >= PUSH_GAP_MS);

  const written = await writeRow(ctx, event, existing, entries, pushNow ? now : existing?.lastPushAt);
  if (!written) return;
  await upsertNotice(ctx, written.fields);

  if (!pushNow) return;
  const moduleMap = await loadModuleMap(ctx);
  const recipients = written.fields.recipientUserIds;
  const users = await loadUsers(ctx, recipients);
  const reachable = recipients.filter((id) => !unreachableReason(users.get(id) ?? null, moduleMap, "events"));
  if (reachable.length === 0) return;
  const member = displayName((await loadUsers(ctx, [userId])).get(userId));
  const title = `Can't make it: ${event.title}`;
  const body = `${member} (${label}) can't make it any more.`;
  await ctx.scheduler.runAfter(0, internal.pushNotificationAction.deliverToUsers, {
    messages: reachable.map((id) => ({ userId: id, title, body, url: `/events/${event._id}` })),
    notificationType: "eventBackout",
    source: "events:backout",
  });
}

/** Call when a member takes back their "can't make it". */
export async function clearBackout(ctx: MutationCtx, event: Doc<"events">, userId: Id<"users">) {
  const existing = await backoutRow(ctx, event._id);
  if (!existing?.entries?.some((e) => e.userId === userId)) return;
  const entries = existing.entries.filter((e) => e.userId !== userId);
  const written = await writeRow(ctx, event, existing, entries, existing.lastPushAt);
  // Patch, not upsert: someone changing back shouldn't resurface the item.
  if (written) {
    await ctx.db.patch(existing._id, {
      entries,
      description: written.description,
      recipientUserIds: written.fields.recipientUserIds,
    });
  }
}
