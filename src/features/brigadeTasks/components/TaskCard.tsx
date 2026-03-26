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
import { CircleCheckBig, Circle, X, TriangleAlert, Calendar, Trash2, PenLine, Send, LoaderCircle, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getRelativeTimeString } from "@/utils/dateUtils";

export type TaskStatus = "active" | "completed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskCategory = "maintenance" | "training" | "admin" | "equipment" | "operations" | "other";

export interface Task {
    _id: Id<"brigadeTasks">;
    title: string;
    description?: string;
    status: TaskStatus;
    priority?: TaskPriority;
    category?: TaskCategory;
    dueDate?: string;
    assignedTo: Id<"users">;
    createdBy: Id<"users">;
    completedAt?: number;
    completedBy?: Id<"users">;
    createdAt: number;
    updatedAt: number;
    updatedBy: Id<"users">;
    assigneeName?: string;
    creatorName?: string;
    commentCount?: number;
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

export const priorityConfig: Record<TaskPriority, { label: string; color: string; bgColor: string; borderColor: string }> = {
    low: { label: "Low", color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-gray-700", borderColor: "border-l-gray-300 dark:border-l-gray-600" },
    normal: { label: "Normal", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-900/30", borderColor: "border-l-blue-400 dark:border-l-blue-500" },
    high: { label: "High", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-900/30", borderColor: "border-l-amber-400 dark:border-l-amber-500" },
    urgent: { label: "Urgent", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-900/30", borderColor: "border-l-red-500 dark:border-l-red-400" },
};

export const categoryConfig: Record<TaskCategory, { label: string; color: string; bgColor: string }> = {
    maintenance: { label: "Maintenance", color: "text-orange-700 dark:text-orange-300", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
    training: { label: "Training", color: "text-purple-700 dark:text-purple-300", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
    admin: { label: "Admin", color: "text-slate-700 dark:text-slate-300", bgColor: "bg-slate-100 dark:bg-slate-800" },
    equipment: { label: "Equipment", color: "text-cyan-700 dark:text-cyan-300", bgColor: "bg-cyan-100 dark:bg-cyan-900/30" },
    operations: { label: "Operations", color: "text-emerald-700 dark:text-emerald-300", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
    other: { label: "Other", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800" },
};

const statusConfig: Record<TaskStatus, { label: string; icon: React.ReactNode; color: string }> = {
    active: { label: "Active", icon: <Circle className="h-5 w-5" />, color: "text-blue-500" },
    completed: { label: "Completed", icon: <CircleCheckBig className="h-5 w-5" />, color: "text-emerald-500" },
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
    const priority = priorityConfig[task.priority || "normal"];
    const category = task.category ? categoryConfig[task.category] : null;

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
    const isDelegated = task.createdBy !== task.assignedTo && task.assignedTo === currentUserId;
    const hasComments = comments && comments.length > 0;

    const formatDueDate = (dueDate?: string) => {
        if (!dueDate) return null;
        const date = new Date(dueDate + "T00:00:00");
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const tomorrow = new Date(todayDate);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.getTime() === todayDate.getTime()) return "Today";
        if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
        return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
    };

    const handleInlineToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isCancelled) return;
        onStatusChange(task._id, isComplete ? "active" : "completed");
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
        } catch {
            toast({ title: "Error", description: "Failed to add comment", variant: "destructive" });
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: Id<"brigadeTaskComments">) => {
        try {
            await deleteComment({ commentId });
            toast({ title: "Comment deleted" });
        } catch {
            toast({ title: "Error", description: "Failed to delete comment", variant: "destructive" });
        }
    };

    // Inline checkbox for the task row
    const checkbox = (
        <button
            onClick={handleInlineToggle}
            className={`
                flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                ${isCancelled ? "border-gray-300 dark:border-gray-600 cursor-not-allowed" : ""}
                ${isComplete
                    ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                    : "border-gray-300 dark:border-gray-500 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                }
            `}
            title={isComplete ? "Reopen task" : "Complete task"}
        >
            {isComplete && <CircleCheckBig className="h-3.5 w-3.5" />}
        </button>
    );

    const taskRow = (
        <div
            className={`
                flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border-l-4 shadow-sm
                cursor-pointer active:bg-gray-50 dark:active:bg-gray-700 transition-all
                ${isCelebrating ? "ring-2 ring-emerald-500 ring-offset-1" : ""}
                ${isComplete ? "opacity-60" : ""}
                ${priority.borderColor}
            `}
        >
            {checkbox}
            <button
                onClick={() => setIsOpen(true)}
                className="flex-1 min-w-0 text-left"
            >
                <div className="flex items-center gap-2">
                    <h3 className={`font-medium truncate ${isComplete ? "line-through text-gray-400" : ""}`}>
                        {task.title}
                    </h3>
                    {task.priority && task.priority !== "normal" && (
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${priority.bgColor} ${priority.color}`}>
                            {priority.label}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
                    {category && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${category.bgColor} ${category.color}`}>
                            {category.label}
                        </span>
                    )}
                    {task.dueDate && (
                        <span className={`flex items-center gap-1 ${
                            isOverdue ? "text-red-600 dark:text-red-400 font-semibold" :
                            isDueToday ? "text-amber-600 dark:text-amber-400" :
                            "text-gray-500 dark:text-gray-400"
                        }`}>
                            {isOverdue && <TriangleAlert className="h-3 w-3" />}
                            {formatDueDate(task.dueDate)}
                        </span>
                    )}
                    {showAssignee && task.assigneeName && (
                        <span className="text-gray-500 dark:text-gray-400">
                            &rarr; {task.assigneeName}
                        </span>
                    )}
                    {isDelegated && task.creatorName && (
                        <span className="text-indigo-500 dark:text-indigo-400 font-medium">
                            from {task.creatorName}
                        </span>
                    )}
                    {(task.commentCount ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-gray-400">
                            <MessageCircle className="h-3 w-3" />
                            {task.commentCount}
                        </span>
                    )}
                </div>
            </button>
        </div>
    );

    const commentsSection = (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-3">
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
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </div>
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

    const detailMeta = (
        <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className={`flex items-center gap-1 ${status.color}`}>
                {status.icon}
                {status.label}
            </span>
            {task.priority && task.priority !== "normal" && (
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${priority.bgColor} ${priority.color}`}>
                    {priority.label} Priority
                </span>
            )}
            {category && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${category.bgColor} ${category.color}`}>
                    {category.label}
                </span>
            )}
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
            {isDelegated && task.creatorName && (
                <span className="text-indigo-500 dark:text-indigo-400">
                    Delegated by: {task.creatorName}
                </span>
            )}
        </div>
    );

    const actionButtons = (
        <>
            {!isCancelled && (
                isComplete ? (
                    <Button variant="outline" onClick={handleReopen} className="w-full h-11 sm:w-auto">
                        <Circle className="h-4 w-4 mr-2" />
                        Reopen Task
                    </Button>
                ) : (
                    <Button onClick={handleComplete} className="w-full h-11 sm:w-auto bg-emerald-600 hover:bg-emerald-700">
                        <CircleCheckBig className="h-4 w-4 mr-2" />
                        Complete Task
                    </Button>
                )
            )}
        </>
    );

    const ownerButtons = isOwner ? (
        <div className="flex gap-2">
            <Button
                variant="outline"
                onClick={() => { setIsOpen(false); onEdit(task); }}
                className="flex-1 h-10 sm:flex-none"
            >
                <PenLine className="h-4 w-4 mr-2" />
                Edit
            </Button>
            <Button
                variant="destructive"
                onClick={() => { setIsOpen(false); onDelete(task._id); }}
                className="flex-1 h-10 sm:flex-none"
            >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
            </Button>
        </div>
    ) : null;

    return (
        <>
            {taskRow}

            {isMobile && isOpen && (
                <Drawer open onOpenChange={(open) => { if (!open) setIsOpen(false); }}>
                    <DrawerContent className="border-gray-700 max-h-[90vh]">
                        <DrawerHeader className="border-b border-gray-200 dark:border-gray-700 pb-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <DrawerTitle className="text-lg font-bold text-left">{task.title}</DrawerTitle>
                                    <div className="mt-2">{detailMeta}</div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 -mr-2 -mt-1">
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </DrawerHeader>
                        <div className="flex-1 overflow-y-auto">
                            {task.description && (
                                <div className="px-4 py-3">
                                    <p className="text-sm text-muted-foreground">{task.description}</p>
                                </div>
                            )}
                            {commentsSection}
                        </div>
                        <div className="p-4 pb-8 border-t border-gray-200 dark:border-gray-700 space-y-2">
                            {actionButtons}
                            {ownerButtons}
                        </div>
                    </DrawerContent>
                </Drawer>
            )}

            {!isMobile && isOpen && (
                <Dialog open onOpenChange={(open) => { if (!open) setIsOpen(false); }}>
                    <DialogContent className="w-[90vw] max-w-3xl xl:max-w-4xl p-0 dark:border-gray-700 max-h-[85vh] overflow-hidden flex flex-col">
                        <DialogHeader className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <DialogTitle className="text-2xl font-bold">{task.title}</DialogTitle>
                            <div className="mt-2">{detailMeta}</div>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto">
                            {task.description && (
                                <div className="px-6 py-4">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                                    <p>{task.description}</p>
                                </div>
                            )}
                            <div className="px-6">{commentsSection}</div>
                        </div>
                        <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex gap-2">{ownerButtons}</div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
                                    {actionButtons}
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
