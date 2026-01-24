import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Circle, X, AlertTriangle, Calendar, Trash2, Edit2, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getRelativeTimeString } from "@/utils/dateUtils";

type TaskStatus = "active" | "completed" | "cancelled";

export interface Task {
    _id: Id<"brigadeTasks">;
    title: string;
    description?: string;
    status: TaskStatus;
    dueDate?: string;
    assignedTo: Id<"users">;
    createdBy: Id<"users">;
    completedAt?: number;
    completedBy?: Id<"users">;
    createdAt: number;
    updatedAt: number;
    updatedBy: Id<"users">;
    assigneeName?: string;
}

interface TaskCardProps {
    task: Task;
    currentUserId?: Id<"users">;
    onStatusChange: (taskId: Id<"brigadeTasks">, status: TaskStatus) => void;
    onEdit: (task: Task) => void;
    onDelete: (taskId: Id<"brigadeTasks">) => void;
    showAssignee?: boolean;
    isCelebrating?: boolean;
}

const statusConfig: Record<TaskStatus, { label: string; icon: React.ReactNode; color: string }> = {
    active: { label: "Active", icon: <Circle className="h-5 w-5" />, color: "text-blue-500" },
    completed: { label: "Completed", icon: <CheckCircle2 className="h-5 w-5" />, color: "text-emerald-500" },
    cancelled: { label: "Cancelled", icon: <X className="h-5 w-5" />, color: "text-gray-400" },
};

export function TaskCard({
    task,
    currentUserId,
    onStatusChange,
    onEdit,
    onDelete,
    showAssignee = false,
    isCelebrating = false
}: TaskCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const isMobile = useIsMobile();
    const { toast } = useToast();
    const status = statusConfig[task.status];

    // Comments query and mutations
    const comments = useQuery(
        api.brigadeTasks.getTaskComments,
        isOpen ? { taskId: task._id } : "skip"
    );
    const addComment = useMutation(api.brigadeTasks.addTaskComment);
    const deleteComment = useMutation(api.brigadeTasks.deleteTaskComment);

    const today = new Date().toISOString().split("T")[0];
    const isOverdue = task.dueDate && task.dueDate < today && task.status !== "completed" && task.status !== "cancelled";
    const isDueToday = task.dueDate === today;
    const isComplete = task.status === "completed";
    const isCancelled = task.status === "cancelled";
    const isOwner = task.createdBy === currentUserId;
    const hasComments = comments && comments.length > 0;

    const formatDueDate = (dueDate?: string) => {
        if (!dueDate) return null;
        const date = new Date(dueDate + "T00:00:00");
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const tomorrow = new Date(todayDate);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.getTime() === todayDate.getTime()) {
            return "Today";
        } else if (date.getTime() === tomorrow.getTime()) {
            return "Tomorrow";
        } else {
            return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
        }
    };

    const handleComplete = () => {
        onStatusChange(task._id, "completed");
        setIsOpen(false);
    };

    const handleReopen = () => {
        onStatusChange(task._id, "active");
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        setIsSubmittingComment(true);
        try {
            await addComment({ taskId: task._id, content: newComment.trim() });
            setNewComment("");
            toast({ title: "Comment added" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to add comment", variant: "destructive" });
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: Id<"brigadeTaskComments">) => {
        try {
            await deleteComment({ commentId });
            toast({ title: "Comment deleted" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete comment", variant: "destructive" });
        }
    };

    // Simple task row - tap to open detail sheet
    const taskRow = (
        <button
            onClick={() => setIsOpen(true)}
            className={`
                w-full text-left overflow-hidden shadow-sm active:bg-gray-50 dark:active:bg-gray-700
                ${isCelebrating ? "ring-2 ring-emerald-500" : ""}
            `}
        >
            <div className="p-3 bg-white dark:bg-gray-800 border-l-4 border-l-gray-300 dark:border-l-gray-600 flex items-center gap-3">
                <span className={`flex-shrink-0 ${status.color}`}>
                    {status.icon}
                </span>
                <div className="flex-1 min-w-0">
                    <h3 className={`font-medium truncate ${isComplete ? "line-through text-gray-400" : ""}`}>
                        {task.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                        {task.dueDate && (
                            <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 dark:text-red-400 font-semibold" :
                                    isDueToday ? "text-amber-600 dark:text-amber-400" :
                                        "text-gray-500 dark:text-gray-400"
                                }`}>
                                {isOverdue && <AlertTriangle className="h-3 w-3" />}
                                {formatDueDate(task.dueDate)}
                            </span>
                        )}
                        {showAssignee && task.assigneeName && (
                            <span className="text-gray-500 dark:text-gray-400">
                                → {task.assigneeName}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );

    // Simple comments section - always visible input, comments shown below if any
    const commentsSection = (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-3">
            {/* Add comment input - single line */}
            <div className="flex gap-2 items-center">
                <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 h-9 px-3 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddComment();
                        }
                    }}
                />
                <Button
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isSubmittingComment}
                    className="h-9 w-9 p-0 flex-shrink-0"
                >
                    {isSubmittingComment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Existing comments - only show if there are any */}
            {hasComments && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {comments.map((comment) => (
                        <div key={comment._id} className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <span className="font-medium">{comment.authorName}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                        {getRelativeTimeString(comment.createdAt)}
                                    </span>
                                </div>
                                {comment.createdBy === currentUserId && (
                                    <button
                                        onClick={() => handleDeleteComment(comment._id)}
                                        className="p-1 text-gray-400 hover:text-red-500"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                            <p className="mt-1">{comment.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <>
            {taskRow}

            {/* Mobile: Bottom sheet drawer */}
            {isMobile && isOpen && (
                <Drawer open onOpenChange={(open) => { if (!open) setIsOpen(false); }}>
                    <DrawerContent className="border-gray-700 max-h-[90vh]">
                        <DrawerHeader className="border-b border-gray-200 dark:border-gray-700 pb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <DrawerTitle className="text-lg font-bold text-left">{task.title}</DrawerTitle>
                                    {task.dueDate && (
                                        <div className="flex items-center gap-2 mt-1 text-sm">
                                            <span className={isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                                                {isOverdue && "Overdue: "}{formatDueDate(task.dueDate)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 -mr-2 -mt-1">
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </DrawerHeader>

                        <div className="flex-1 overflow-y-auto">
                            {/* Description */}
                            {task.description && (
                                <div className="px-4 py-3">
                                    <p className="text-sm text-muted-foreground">{task.description}</p>
                                </div>
                            )}

                            {/* Comments */}
                            {commentsSection}
                        </div>

                        {/* Footer actions */}
                        <div className="p-4 pb-8 border-t border-gray-200 dark:border-gray-700 space-y-2">
                            {/* Complete/Reopen button */}
                            {!isCancelled && (
                                isComplete ? (
                                    <Button
                                        variant="outline"
                                        onClick={handleReopen}
                                        className="w-full h-11"
                                    >
                                        <Circle className="h-4 w-4 mr-2" />
                                        Reopen Task
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleComplete}
                                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Complete Task
                                    </Button>
                                )
                            )}

                            {/* Edit/Delete - only for owner */}
                            {isOwner && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsOpen(false);
                                            onEdit(task);
                                        }}
                                        className="flex-1 h-10"
                                    >
                                        <Edit2 className="h-4 w-4 mr-2" />
                                        Edit
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            setIsOpen(false);
                                            onDelete(task._id);
                                        }}
                                        className="flex-1 h-10"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DrawerContent>
                </Drawer>
            )}

            {/* Desktop: Wide responsive dialog */}
            {!isMobile && isOpen && (
                <Dialog open onOpenChange={(open) => { if (!open) setIsOpen(false); }}>
                    <DialogContent className="w-[90vw] max-w-3xl xl:max-w-4xl p-0 dark:border-gray-700 max-h-[85vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <DialogHeader className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <DialogTitle className="text-2xl font-bold">{task.title}</DialogTitle>
                                    <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
                                        <span className={`flex items-center gap-1 ${status.color}`}>
                                            {status.icon}
                                            {status.label}
                                        </span>
                                        {task.dueDate && (
                                            <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                                                <Calendar className="h-4 w-4" />
                                                {formatDueDate(task.dueDate)}
                                                {isOverdue && " (Overdue)"}
                                            </span>
                                        )}
                                        {showAssignee && task.assigneeName && (
                                            <span className="text-muted-foreground">
                                                Assigned to: {task.assigneeName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Description */}
                            {task.description && (
                                <div className="px-6 py-4">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                                    <p>{task.description}</p>
                                </div>
                            )}

                            {/* Comments */}
                            <div className="px-6">
                                {commentsSection}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <div className="flex items-center justify-between gap-4">
                                {/* Left side - Edit/Delete for owner */}
                                <div className="flex gap-2">
                                    {isOwner && (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    onEdit(task);
                                                }}
                                            >
                                                <Edit2 className="h-4 w-4 mr-2" />
                                                Edit
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    onDelete(task._id);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </Button>
                                        </>
                                    )}
                                </div>

                                {/* Right side - Primary action */}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Close
                                    </Button>
                                    {!isCancelled && (
                                        isComplete ? (
                                            <Button
                                                variant="outline"
                                                onClick={handleReopen}
                                            >
                                                <Circle className="h-4 w-4 mr-2" />
                                                Reopen Task
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={handleComplete}
                                                className="bg-emerald-600 hover:bg-emerald-700"
                                            >
                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                Complete Task
                                            </Button>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
