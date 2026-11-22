import { ActionProvider } from "./types";

/** Admins: self-service sign-ups waiting to be approved. */
export const pendingSignupsProvider: ActionProvider = async (ctx, p) => {
  if (!p.user.isAdmin) return [];

  const pending = await ctx.db
    .query("users")
    .withIndex("by_approvalStatus", (q) => q.eq("approvalStatus", "pending"))
    .take(50);
  if (pending.length === 0) return [];

  const oldest = Math.min(...pending.map((u) => u._creationTime));
  return [
    {
      id: "admin:pendingSignups",
      moduleId: "admin",
      kind: "pendingSignups",
      title: pending.length === 1 ? "1 sign-up waiting for approval" : `${pending.length} sign-ups waiting for approval`,
      description: "Approve or reject them in User Management.",
      url: "/admin",
      actionLabel: "Review",
      priority: "high",
      count: pending.length,
      createdAt: oldest,
    },
  ];
};
