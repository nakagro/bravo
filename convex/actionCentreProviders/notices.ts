import { ActionProvider } from "./types";
import { noticeActionId } from "../lib/notifyEvent";

// Notices age out of the Action Centre on their own - "the checks were done"
// stops being news long before it stops being history. The submission record is
// the durable account of what happened; this is just the nudge to go look.
const NOTICE_WINDOW_DAYS = 30;

/**
 * Surfaces stored `actionNotices` for the signed-in user. Unlike the derived
 * providers there's no condition to recompute - a notice is visible until the
 * user waves it away (a dismissal, filtered out in getMyActions) or it ages out.
 */
export const noticesProvider: ActionProvider = async (ctx, p) => {
  const cutoff = Date.now() - NOTICE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const notices = await ctx.db
    .query("actionNotices")
    .withIndex("by_createdAt", (q) => q.gt("createdAt", cutoff))
    .order("desc")
    .take(100);

  return notices
    .filter(
      (notice) =>
        notice.recipientUserIds.includes(p.userId) &&
        p.hasModuleAccess(notice.moduleId)
    )
    .map((notice) => ({
      id: noticeActionId(notice._id),
      moduleId: notice.moduleId,
      kind: "notice",
      title: notice.title,
      description: notice.description,
      url: notice.url,
      actionLabel: "View",
      priority: notice.priority,
      createdAt: notice.createdAt,
      dismissible: true,
    }));
};
