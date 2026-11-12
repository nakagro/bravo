import { ActionProvider } from "./types";

// Same window notices use.
const WINDOW_DAYS = 30;

/**
 * A member's assignment notices ("You're rostered: Open day"). The receipt is
 * the item, read by index, so a big roster send can't crowd anyone's other
 * notices out the way one actionNotices row per member would. The id carries
 * sentAt, so a re-send brings back an item the member had dismissed.
 */
export const assignmentsProvider: ActionProvider = async (ctx, p) => {
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const receipts = await ctx.db
    .query("assignmentReceipts")
    .withIndex("by_user_sentAt", (q) => q.eq("userId", p.userId).gt("sentAt", cutoff))
    .order("desc")
    .take(50);

  return receipts
    .filter((r) => p.hasModuleAccess(r.moduleId))
    .map((r) => ({
      id: `assignment:${r._id}:${r.sentAt}`,
      moduleId: r.moduleId,
      kind: "notice",
      title: r.title,
      description: r.body,
      url: r.url,
      actionLabel: "View",
      priority: "medium" as const,
      createdAt: r.sentAt,
      dismissible: true,
    }));
};
