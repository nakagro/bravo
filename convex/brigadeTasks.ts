import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Shared helper to resolve user display name
function getUserDisplayName(user: {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
} | null): string {
  if (!user) return "Unknown";
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return fullName || user.name || user.email || "Unknown";
}

// Shared sort: due date ascending (tasks with dates first), then created date descending
function sortTasks<T extends { dueDate?: string; createdAt: number }>(tasks: T[]): T[] {
  return tasks.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return b.createdAt - a.createdAt;
  });
}

// Priority validators
const priorityValidator = v.optional(
  v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"))
);
const categoryValidator = v.optional(
  v.union(
    v.literal("maintenance"),
    v.literal("training"),
    v.literal("admin"),
    v.literal("equipment"),
    v.literal("operations"),
    v.literal("other")
  )
);

/**
 * Get all tasks for the current user (assigned to them)
 */
export const getMyTasks = query({
  args: {
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let tasks = await ctx.db
      .query("brigadeTasks")
      .withIndex("by_assignedTo", (q) => q.eq("assignedTo", userId))
      .collect();

    // Exclude soft-deleted
    tasks = tasks.filter((t) => !t.deletedAt);

    if (!args.includeCompleted) {
      tasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
    }

    sortTasks(tasks);

    // Get comment counts and creator names for delegated tasks
    const tasksWithMeta = await Promise.all(
      tasks.map(async (task) => {
        const comments = await ctx.db
          .query("brigadeTaskComments")
          .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
          .collect();
        const creator =
          task.createdBy !== userId ? await ctx.db.get(task.createdBy) : null;
        return {
          ...task,
          commentCount: comments.length,
          creatorName: creator ? getUserDisplayName(creator) : undefined,
        };
      })
    );

    return tasksWithMeta;
  },
});

/**
 * Get tasks created by the current user
 */
export const getTasksCreatedByMe = query({
  args: {
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let tasks = await ctx.db
      .query("brigadeTasks")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
      .collect();

    tasks = tasks.filter((t) => !t.deletedAt);

    if (!args.includeCompleted) {
      tasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
    }

    sortTasks(tasks);

    const tasksWithMeta = await Promise.all(
      tasks.map(async (task) => {
        const assignee = await ctx.db.get(task.assignedTo);
        const comments = await ctx.db
          .query("brigadeTaskComments")
          .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
          .collect();
        return {
          ...task,
          assigneeName: getUserDisplayName(assignee),
          commentCount: comments.length,
        };
      })
    );

    return tasksWithMeta;
  },
});

/**
 * Get all brigade tasks - available to all members for visibility
 */
export const getAllTasks = query({
  args: {
    includeCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let tasks = await ctx.db.query("brigadeTasks").collect();

    tasks = tasks.filter((t) => !t.deletedAt);

    if (!args.includeCompleted) {
      tasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
    }

    sortTasks(tasks);

    const tasksWithMeta = await Promise.all(
      tasks.map(async (task) => {
        const [assignee, creator] = await Promise.all([
          ctx.db.get(task.assignedTo),
          ctx.db.get(task.createdBy),
        ]);
        const comments = await ctx.db
          .query("brigadeTaskComments")
          .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
          .collect();
        return {
          ...task,
          assigneeName: getUserDisplayName(assignee),
          creatorName: getUserDisplayName(creator),
          commentCount: comments.length,
        };
      })
    );

    return tasksWithMeta;
  },
});

/**
 * Create a new task
 */
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    priority: priorityValidator,
    category: categoryValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to create a task");

    const now = Date.now();

    const taskId = await ctx.db.insert("brigadeTasks", {
      title: args.title,
      description: args.description,
      status: "active",
      priority: args.priority || "normal",
      category: args.category,
      dueDate: args.dueDate,
      assignedTo: args.assignedTo || userId,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    });

    return taskId;
  },
});

/**
 * Update a task's status
 */
export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("brigadeTasks"),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to update a task");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const user = await ctx.db.get(userId);
    const canModify = task.assignedTo === userId || task.createdBy === userId || user?.isAdmin;
    if (!canModify) throw new Error("You don't have permission to update this task");

    const now = Date.now();
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
      updatedBy: userId,
    };

    if (args.status === "completed") {
      updates.completedAt = now;
      updates.completedBy = userId;
    }

    await ctx.db.patch(args.taskId, updates);
    return true;
  },
});

/**
 * Update a task's details
 */
export const updateTask = mutation({
  args: {
    taskId: v.id("brigadeTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    priority: priorityValidator,
    category: categoryValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to update a task");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const user = await ctx.db.get(userId);
    const canModify = task.createdBy === userId || user?.isAdmin;
    if (!canModify) throw new Error("You don't have permission to edit this task");

    const now = Date.now();
    const updates: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: userId,
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
    if (args.assignedTo !== undefined) updates.assignedTo = args.assignedTo;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.category !== undefined) updates.category = args.category;

    await ctx.db.patch(args.taskId, updates);
    return true;
  },
});

/**
 * Soft-delete a task
 */
export const deleteTask = mutation({
  args: {
    taskId: v.id("brigadeTasks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to delete a task");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const user = await ctx.db.get(userId);
    const canDelete = task.createdBy === userId || user?.isAdmin;
    if (!canDelete) throw new Error("You don't have permission to delete this task");

    // Soft delete
    await ctx.db.patch(args.taskId, {
      deletedAt: Date.now(),
      deletedBy: userId,
    });

    return true;
  },
});

/**
 * Get task counts for the current user
 */
export const getTaskCounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { myTasks: 0, overdue: 0 };

    const tasks = await ctx.db
      .query("brigadeTasks")
      .withIndex("by_assignedTo", (q) => q.eq("assignedTo", userId))
      .collect();

    const activeTasks = tasks.filter(
      (t) => !t.deletedAt && t.status !== "completed" && t.status !== "cancelled"
    );

    const today = new Date().toISOString().split("T")[0];
    const overdueTasks = activeTasks.filter((t) => t.dueDate && t.dueDate < today);

    return {
      myTasks: activeTasks.length,
      overdue: overdueTasks.length,
    };
  },
});

// ============================================================================
// TASK COMMENTS
// ============================================================================

/**
 * Get comments for a task
 */
export const getTaskComments = query({
  args: {
    taskId: v.id("brigadeTasks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const comments = await ctx.db
      .query("brigadeTaskComments")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    comments.sort((a, b) => a.createdAt - b.createdAt);

    const commentsWithUsers = await Promise.all(
      comments.map(async (comment) => {
        const user = await ctx.db.get(comment.createdBy);
        return {
          ...comment,
          authorName: getUserDisplayName(user),
        };
      })
    );

    return commentsWithUsers;
  },
});

/**
 * Add a comment to a task
 */
export const addTaskComment = mutation({
  args: {
    taskId: v.id("brigadeTasks"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to add a comment");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const commentId = await ctx.db.insert("brigadeTaskComments", {
      taskId: args.taskId,
      content: args.content.trim(),
      createdBy: userId,
      createdAt: Date.now(),
    });

    return commentId;
  },
});

/**
 * Delete a comment
 */
export const deleteTaskComment = mutation({
  args: {
    commentId: v.id("brigadeTaskComments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to delete a comment");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    const user = await ctx.db.get(userId);
    if (comment.createdBy !== userId && !user?.isAdmin) {
      throw new Error("You don't have permission to delete this comment");
    }

    await ctx.db.delete(args.commentId);
    return true;
  },
});
