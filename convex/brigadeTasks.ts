import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get all tasks for the current user (assigned to them)
 */
export const getMyTasks = query({
    args: {
        includeCompleted: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return [];
        }

        let tasks = await ctx.db
            .query("brigadeTasks")
            .withIndex("by_assignedTo", (q) => q.eq("assignedTo", userId))
            .collect();

        // Filter out completed/cancelled tasks if not requested
        if (!args.includeCompleted) {
            tasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
        }

        // Sort by due date (tasks with due dates first, earlier dates first) then by creation date
        tasks.sort((a, b) => {
            // First by due date
            if (a.dueDate && b.dueDate) {
                return a.dueDate.localeCompare(b.dueDate);
            }
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;

            // Then by created date (newer first)
            return b.createdAt - a.createdAt;
        });

        return tasks;
    },
});

/**
 * Get tasks created by the current user (tasks they've assigned to others or themselves)
 */
export const getTasksCreatedByMe = query({
    args: {
        includeCompleted: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return [];
        }

        let tasks = await ctx.db
            .query("brigadeTasks")
            .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
            .collect();

        // Filter out completed/cancelled tasks if not requested
        if (!args.includeCompleted) {
            tasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
        }

        // Sort by due date then creation date
        tasks.sort((a, b) => {
            if (a.dueDate && b.dueDate) {
                return a.dueDate.localeCompare(b.dueDate);
            }
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            return b.createdAt - a.createdAt;
        });

        // Get assignee info for each task
        const tasksWithAssignees = await Promise.all(
            tasks.map(async (task) => {
                const assignee = await ctx.db.get(task.assignedTo);
                return {
                    ...task,
                    assigneeName: assignee
                        ? `${assignee.firstName || ""} ${assignee.lastName || ""}`.trim() ||
                        assignee.name ||
                        assignee.email ||
                        "Unknown"
                        : "Unknown",
                };
            })
        );

        return tasksWithAssignees;
    },
});

/**
 * Get all tasks (for management view - requires permission)
 */
export const getAllTasks = query({
    args: {
        includeCompleted: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return [];
        }

        // Check if user is admin - only admins can see all tasks
        const user = await ctx.db.get(userId);
        if (!user?.isAdmin) {
            // For non-admins, return their own tasks
            return [];
        }

        let tasks = await ctx.db.query("brigadeTasks").collect();

        // Filter out completed/cancelled tasks if not requested
        if (!args.includeCompleted) {
            tasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
        }

        // Sort by due date then creation date
        tasks.sort((a, b) => {
            if (a.dueDate && b.dueDate) {
                return a.dueDate.localeCompare(b.dueDate);
            }
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            return b.createdAt - a.createdAt;
        });

        // Get assignee and creator info for each task
        const tasksWithUsers = await Promise.all(
            tasks.map(async (task) => {
                const [assignee, creator] = await Promise.all([
                    ctx.db.get(task.assignedTo),
                    ctx.db.get(task.createdBy),
                ]);
                return {
                    ...task,
                    assigneeName: assignee
                        ? `${assignee.firstName || ""} ${assignee.lastName || ""}`.trim() ||
                        assignee.name ||
                        assignee.email ||
                        "Unknown"
                        : "Unknown",
                    creatorName: creator
                        ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() ||
                        creator.name ||
                        creator.email ||
                        "Unknown"
                        : "Unknown",
                };
            })
        );

        return tasksWithUsers;
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
        assignedTo: v.optional(v.id("users")), // If not provided, assigns to self
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("You must be signed in to create a task");
        }

        const now = Date.now();
        const assignedTo = args.assignedTo || userId;

        const taskId = await ctx.db.insert("brigadeTasks", {
            title: args.title,
            description: args.description,
            status: "active",
            dueDate: args.dueDate,
            assignedTo: assignedTo,
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
        status: v.union(
            v.literal("active"),
            v.literal("completed"),
            v.literal("cancelled")
        ),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("You must be signed in to update a task");
        }

        const task = await ctx.db.get(args.taskId);
        if (!task) {
            throw new Error("Task not found");
        }

        // Check if user can modify this task (assigned to them, created by them, or admin)
        const user = await ctx.db.get(userId);
        const canModify =
            task.assignedTo === userId || task.createdBy === userId || user?.isAdmin;

        if (!canModify) {
            throw new Error("You don't have permission to update this task");
        }

        const now = Date.now();
        const updates: {
            status: typeof args.status;
            updatedAt: number;
            updatedBy: typeof userId;
            completedAt?: number;
            completedBy?: typeof userId;
        } = {
            status: args.status,
            updatedAt: now,
            updatedBy: userId,
        };

        // If marking as completed, set completion details
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
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("You must be signed in to update a task");
        }

        const task = await ctx.db.get(args.taskId);
        if (!task) {
            throw new Error("Task not found");
        }

        // Check if user can modify this task (created by them or admin)
        const user = await ctx.db.get(userId);
        const canModify = task.createdBy === userId || user?.isAdmin;

        if (!canModify) {
            throw new Error("You don't have permission to edit this task");
        }

        const now = Date.now();
        const updates: Partial<{
            title: string;
            description: string;
            dueDate: string;
            assignedTo: typeof userId;
            updatedAt: number;
            updatedBy: typeof userId;
        }> = {
            updatedAt: now,
            updatedBy: userId,
        };

        if (args.title !== undefined) updates.title = args.title;
        if (args.description !== undefined) updates.description = args.description;
        if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
        if (args.assignedTo !== undefined) updates.assignedTo = args.assignedTo;

        await ctx.db.patch(args.taskId, updates);

        return true;
    },
});

/**
 * Delete a task
 */
export const deleteTask = mutation({
    args: {
        taskId: v.id("brigadeTasks"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("You must be signed in to delete a task");
        }

        const task = await ctx.db.get(args.taskId);
        if (!task) {
            throw new Error("Task not found");
        }

        // Check if user can delete this task (created by them or admin)
        const user = await ctx.db.get(userId);
        const canDelete = task.createdBy === userId || user?.isAdmin;

        if (!canDelete) {
            throw new Error("You don't have permission to delete this task");
        }

        await ctx.db.delete(args.taskId);

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
        if (!userId) {
            return { myTasks: 0, overdue: 0, urgent: 0 };
        }

        const tasks = await ctx.db
            .query("brigadeTasks")
            .withIndex("by_assignedTo", (q) => q.eq("assignedTo", userId))
            .collect();

        const activeTasks = tasks.filter(
            (t) => t.status !== "completed" && t.status !== "cancelled"
        );

        const today = new Date().toISOString().split("T")[0];
        const overdueTasks = activeTasks.filter(
            (t) => t.dueDate && t.dueDate < today
        );

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
        if (!userId) {
            return [];
        }

        const comments = await ctx.db
            .query("brigadeTaskComments")
            .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
            .collect();

        // Sort by created date (oldest first)
        comments.sort((a, b) => a.createdAt - b.createdAt);

        // Get user info for each comment
        const commentsWithUsers = await Promise.all(
            comments.map(async (comment) => {
                const user = await ctx.db.get(comment.createdBy);
                return {
                    ...comment,
                    authorName: user
                        ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                        user.name ||
                        "Unknown"
                        : "Unknown",
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
        if (!userId) {
            throw new Error("You must be signed in to add a comment");
        }

        // Verify task exists
        const task = await ctx.db.get(args.taskId);
        if (!task) {
            throw new Error("Task not found");
        }

        const now = Date.now();

        const commentId = await ctx.db.insert("brigadeTaskComments", {
            taskId: args.taskId,
            content: args.content.trim(),
            createdBy: userId,
            createdAt: now,
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
        if (!userId) {
            throw new Error("You must be signed in to delete a comment");
        }

        const comment = await ctx.db.get(args.commentId);
        if (!comment) {
            throw new Error("Comment not found");
        }

        // Only the author or an admin can delete a comment
        const user = await ctx.db.get(userId);
        if (comment.createdBy !== userId && !user?.isAdmin) {
            throw new Error("You don't have permission to delete this comment");
        }

        await ctx.db.delete(args.commentId);

        return true;
    },
});
