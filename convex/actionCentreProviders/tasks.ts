import { ActionProvider } from "./types";
import { formatDateAU } from "../lib/dates";

const RANK_ORDER: Record<string, number> = {
  "Brigade Member": 0,
  Probationary: 1,
  Firefighter: 2,
  Lieutenant: 3,
  Captain: 4,
};

export const tasksProvider: ActionProvider = async (ctx, p) => {
  if (!p.hasModuleAccess("actions")) return [];

  const { userId, user } = p;
  const userRank = user.rank;
  const userRoles = user.roles ?? [];
  const userRankOrder = userRank ? (RANK_ORDER[userRank] ?? 0) : 0;

  const openTasks = await ctx.db
    .query("actionTasks")
    .withIndex("by_status", (q) => q.eq("status", "open"))
    .collect();

  const actions = [];

  for (const task of openTasks) {
    const hasNoAssignment =
      task.assignedUserIds.length === 0 &&
      task.assignedRoles.length === 0 &&
      !task.minimumRank;

    const matchesUser = task.assignedUserIds.includes(userId);
    const matchesRole = task.assignedRoles.some((r) => userRoles.includes(r));
    const matchesRank = task.minimumRank
      ? userRankOrder >= (RANK_ORDER[task.minimumRank] ?? 0)
      : false;

    if (!(hasNoAssignment || matchesUser || matchesRole || matchesRank)) continue;

    const desc = [
      task.description,
      task.dueDate ? `Due: ${formatDateAU(task.dueDate)}` : undefined,
    ]
      .filter(Boolean)
      .join(" · ");

    actions.push({
      id: `actions:task:${task._id}`,
      moduleId: "actions",
      kind: "task",
      title: task.title,
      description: desc || undefined,
      url: `/actions?task=${task._id}`,
      actionLabel: "Complete",
      priority: task.priority,
      createdAt: task.createdAt,
      meta: { taskId: task._id },
    });
  }

  return actions;
};
