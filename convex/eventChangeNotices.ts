import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { eventManagerId, requireEventManager } from "./events";
import { cleanNote } from "./assignmentNotices";
import { applyChangeNotice, buildChangePreview } from "./lib/eventChangeNotice";

// Previews and later sends for event change notices. Cancel and restore with a
// notice happen inside cancelEvent/restoreEvent (same transaction); this file
// covers the preview those dialogs show, the "date changed, tell them?" send
// after an edit, and announcing a cancellation that wasn't announced at the time.

const kindValidator = v.union(v.literal("cancelled"), v.literal("detailsChanged"), v.literal("restored"));
const reasonValidator = v.union(
  v.literal("rostered"),
  v.literal("going"),
  v.literal("maybe"),
  v.literal("offered"),
  v.literal("told"),
);

export const previewEventChangeNotice = query({
  args: { eventId: v.id("events"), kind: kindValidator, message: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      body: v.string(),
      recipients: v.array(v.object({ userId: v.id("users"), name: v.string(), reason: reasonValidator })),
      counts: v.object({
        rostered: v.number(),
        going: v.number(),
        maybe: v.number(),
        offered: v.number(),
        told: v.number(),
      }),
      cantNotify: v.number(),
      fingerprint: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;
    const senderId = await eventManagerId(ctx, event);
    if (!senderId) return null;
    // The cancel and restore dialogs preview the change they're about to make.
    const pending =
      (args.kind === "cancelled" && event.status === "active") ||
      (args.kind === "restored" && event.status === "cancelled");
    return await buildChangePreview(ctx, event, senderId, args.kind, cleanNote(args.message), pending);
  },
});

/** "Changed: …" after an edit, or a cancellation announced after the fact. */
export const sendEventChangeNotice = mutation({
  args: {
    eventId: v.id("events"),
    kind: v.union(v.literal("cancelled"), v.literal("detailsChanged")),
    message: v.optional(v.string()),
    fingerprint: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { userId, event } = await requireEventManager(ctx, args.eventId);
    const preview = await buildChangePreview(ctx, event, userId, args.kind, cleanNote(args.message), false);
    if (!preview) throw new Error("This notice can't be sent for this event now");
    if (preview.fingerprint !== args.fingerprint) {
      throw new Error("The event or message changed, check it again");
    }
    if (preview.recipients.length === 0) throw new Error("There's nobody to send to");
    await applyChangeNotice(ctx, event, userId, args.kind, preview, args.message?.trim());
    return preview.recipients.length;
  },
});
