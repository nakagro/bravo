import { ActionProvider } from "./types";

export const bookingApprovalsProvider: ActionProvider = async (ctx, p) => {
  if (!p.hasModuleAccess("bookings")) return [];

  const { userId, user } = p;

  const resources = await ctx.db.query("bookingResources").collect();
  let myResourceIds: string[];

  if (user.isAdmin) {
    myResourceIds = resources.map((r) => r._id);
  } else {
    myResourceIds = resources
      .filter((r) => r.approvers.includes(userId))
      .map((r) => r._id);
  }

  if (myResourceIds.length === 0) return [];

  const allPending = await ctx.db
    .query("bookings")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .collect();

  const mine = allPending.filter((b) => myResourceIds.includes(b.resourceId));
  if (mine.length === 0) return [];

  // A repeating booking is one request to review, however many dates it has
  const requests = new Set(mine.map((b) => b.seriesId ?? b._id)).size;

  return [
    {
      id: "bookings:bookingApprovals",
      moduleId: "bookings",
      kind: "bookingApprovals",
      title: `${requests} booking${requests > 1 ? "s" : ""} awaiting approval`,
      description: `You have ${requests} pending booking request${requests > 1 ? "s" : ""} to review.`,
      url: "/bookings",
      actionLabel: "Review Bookings",
      priority: "high",
      count: requests,
      createdAt: Math.min(...mine.map((b) => b.createdAt)),
    },
  ];
};
