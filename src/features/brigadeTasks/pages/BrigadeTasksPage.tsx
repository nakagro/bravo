import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle2 } from "lucide-react";

import { Task, TaskCard } from "../components/TaskCard";
import { TaskFilters, FilterType } from "../components/TaskFilters";
import { TaskForm } from "../components/TaskForm";
import { QuickAddTask } from "../components/QuickAddTask";

type TaskStatus = "active" | "completed" | "cancelled";

export function BrigadeTasksPage() {
    const [activeTab, setActiveTab] = useState("my-tasks");
    const [showCompleted, setShowCompleted] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Id<"brigadeTasks"> | null>(null);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterType>("all");
    const [quickAddText, setQuickAddText] = useState("");
    const [isQuickAdding, setIsQuickAdding] = useState(false);
    const [celebratingTaskId, setCelebratingTaskId] = useState<Id<"brigadeTasks"> | null>(null);

    const isMobile = useIsMobile();
    const { toast } = useToast();

    // Tab animation refs
    const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

    // Queries
    const myTasks = useQuery(api.brigadeTasks.getMyTasks, { includeCompleted: showCompleted });
    const createdTasks = useQuery(api.brigadeTasks.getTasksCreatedByMe, { includeCompleted: showCompleted });
    const taskCounts = useQuery(api.brigadeTasks.getTaskCounts);
    const currentUser = useQuery(api.auth.loggedInUser);
    const allUsers = useQuery(api.bookings.getAllUsers);

    // Mutations
    const createTask = useMutation(api.brigadeTasks.createTask);
    const updateTask = useMutation(api.brigadeTasks.updateTask);
    const updateTaskStatus = useMutation(api.brigadeTasks.updateTaskStatus);
    const deleteTask = useMutation(api.brigadeTasks.deleteTask);

    // Dates
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split("T")[0];

    // Filter tasks
    const filteredTasks = useMemo(() => {
        const tasks = activeTab === "my-tasks" ? myTasks : createdTasks;
        if (!tasks) return undefined;

        let result = tasks;

        switch (activeFilter) {
            case "overdue":
                result = result.filter((t) => t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "cancelled");
                break;
            case "today":
                result = result.filter((t) => t.dueDate === today && t.status !== "completed" && t.status !== "cancelled");
                break;
        }

        return result;
    }, [myTasks, createdTasks, activeTab, activeFilter, today]);

    // Group tasks by date
    const groupedTasks = useMemo(() => {
        if (!filteredTasks) return null;

        const groups = {
            overdue: [] as Task[],
            today: [] as Task[],
            tomorrow: [] as Task[],
            upcoming: [] as Task[],
            noDate: [] as Task[],
            completed: [] as Task[]
        };

        filteredTasks.forEach(task => {
            if (task.status === "completed" || task.status === "cancelled") {
                groups.completed.push(task);
                return;
            }

            if (!task.dueDate) {
                groups.noDate.push(task);
            } else if (task.dueDate < today) {
                groups.overdue.push(task);
            } else if (task.dueDate === today) {
                groups.today.push(task);
            } else if (task.dueDate === tomorrow) {
                groups.tomorrow.push(task);
            } else {
                groups.upcoming.push(task);
            }
        });

        return groups;
    }, [filteredTasks, today, tomorrow]);

    // Filter counts for the dropdown
    const filterCounts = useMemo(() => {
        const tasks = activeTab === "my-tasks" ? myTasks : createdTasks;
        if (!tasks) return { today: 0, overdue: 0 };

        const active = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled");
        return {
            today: active.filter(t => t.dueDate === today).length,
            overdue: active.filter(t => t.dueDate && t.dueDate < today).length,
        };
    }, [myTasks, createdTasks, activeTab, today]);

    // Handlers
    const handleQuickAdd = async () => {
        if (!quickAddText.trim()) return;
        setIsQuickAdding(true);
        try {
            await createTask({
                title: quickAddText.trim(),
            });
            setQuickAddText("");
            toast({ title: "Task added!", description: "Your task has been created" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
        } finally {
            setIsQuickAdding(false);
        }
    };

    const handleSubmitTask = async (data: { title: string; description: string; dueDate: string; assignedTo: string }) => {
        if (taskToEdit) {
            await updateTask({
                taskId: taskToEdit._id,
                title: data.title,
                description: data.description || undefined,
                dueDate: data.dueDate || undefined,
                assignedTo: data.assignedTo === "self" ? currentUser?._id : (data.assignedTo as Id<"users">),
            });
            toast({ title: "Task updated", description: "Your changes have been saved" });
            setTaskToEdit(null);
        } else {
            await createTask({
                title: data.title,
                description: data.description || undefined,
                dueDate: data.dueDate || undefined,
                assignedTo: data.assignedTo === "self" ? undefined : (data.assignedTo as Id<"users">),
            });
            toast({ title: "Task created", description: data.assignedTo !== "self" ? "Task assigned successfully" : "Your task has been added" });
        }
    };

    const handleStatusChange = async (taskId: Id<"brigadeTasks">, newStatus: TaskStatus) => {
        try {
            if (newStatus === "completed") {
                setCelebratingTaskId(taskId);
                setTimeout(() => setCelebratingTaskId(null), 1000);
                toast({ title: "🎉 Task completed!", description: "Great job getting that done!" });
            }
            await updateTaskStatus({ taskId, status: newStatus });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update task status", variant: "destructive" });
        }
    };

    const handleDeleteTask = async () => {
        if (!taskToDelete) return;
        try {
            await deleteTask({ taskId: taskToDelete });
            toast({ title: "Task deleted", description: "The task has been removed" });
            setTaskToDelete(null);
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
        }
    };

    const getIndicatorStyle = () => {
        const el = tabRefs.current[activeTab];
        return el ? { left: el.offsetLeft, width: el.offsetWidth } : { left: 0, width: 0 };
    };

    const isLoading = filteredTasks === undefined;

    // Render a task group section
    const renderTaskGroup = (title: string, tasks: Task[], titleColor = "text-gray-900 dark:text-white") => {
        if (tasks.length === 0) return null;
        return (
            <div className="mb-4">
                <h3 className={`text-sm font-semibold ${titleColor} px-1 mb-2`}>{title} ({tasks.length})</h3>
                <div className="space-y-0">
                    {tasks.map(task => (
                        <TaskCard
                            key={task._id}
                            task={task}
                            currentUserId={currentUser?._id}
                            showAssignee={activeTab === "created"}
                            isCelebrating={celebratingTaskId === task._id}
                            onStatusChange={handleStatusChange}
                            onEdit={setTaskToEdit}
                            onDelete={setTaskToDelete}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4" data-component="BrigadeTasksPage">
            {/* Header */}
            <div className="flex justify-between items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Brigade Tasks</h1>
                <Button onClick={() => setIsCreateDialogOpen(true)} size="sm" className="shadow-sm">
                    <Plus className="h-4 w-4 mr-1" />
                    {isMobile ? "" : "New Task"}
                </Button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 relative">
                <nav className="flex gap-x-1 -mb-px">
                    <button
                        ref={(el) => { tabRefs.current["my-tasks"] = el; }}
                        onClick={() => setActiveTab("my-tasks")}
                        className={`py-2.5 px-3 text-sm transition-colors whitespace-nowrap ${activeTab === "my-tasks"
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                            }`}
                    >
                        My Tasks
                        {taskCounts && taskCounts.myTasks > 0 && (
                            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-semibold">
                                {taskCounts.myTasks}
                            </span>
                        )}
                    </button>
                    <button
                        ref={(el) => { tabRefs.current["created"] = el; }}
                        onClick={() => setActiveTab("created")}
                        className={`py-2.5 px-3 text-sm transition-colors whitespace-nowrap ${activeTab === "created"
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                            }`}
                    >
                        Created by Me
                    </button>
                </nav>
                <div
                    className="absolute bottom-0 h-0.5 bg-red-500 dark:bg-red-400 transition-all duration-300 ease-out"
                    style={getIndicatorStyle()}
                />
            </div>

            {/* Quick Add + Filter - inline row */}
            <div className="flex gap-2 items-center">
                <div className="flex-1">
                    <QuickAddTask
                        quickAddText={quickAddText}
                        isQuickAdding={isQuickAdding}
                        onTextChange={setQuickAddText}
                        onSubmit={handleQuickAdd}
                    />
                </div>
                <TaskFilters
                    activeFilter={activeFilter}
                    filterCounts={filterCounts}
                    showCompleted={showCompleted}
                    onFilterChange={setActiveFilter}
                    onShowCompletedChange={setShowCompleted}
                />
            </div>

            {/* Task List */}
            <div className="min-h-[200px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                        <div className="h-8 w-8 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                        <p className="text-sm">Loading tasks...</p>
                    </div>
                ) : !filteredTasks || filteredTasks.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 shadow-sm p-6 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                            <CheckCircle2 className="h-6 w-6 text-gray-400" />
                        </div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                            {activeFilter !== "all"
                                ? "No matching tasks"
                                : activeTab === "my-tasks"
                                    ? "You're all caught up!"
                                    : "No tasks created yet"
                            }
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {activeFilter !== "all"
                                ? "Try adjusting your filters"
                                : "Use the quick add above to create a task"
                            }
                        </p>
                    </div>
                ) : (
                    <div>
                        {groupedTasks && (
                            <>
                                {renderTaskGroup("Overdue", groupedTasks.overdue, "text-red-600 dark:text-red-400")}
                                {renderTaskGroup("Today", groupedTasks.today, "text-amber-600 dark:text-amber-400")}
                                {renderTaskGroup("Tomorrow", groupedTasks.tomorrow)}
                                {renderTaskGroup("Upcoming", groupedTasks.upcoming)}
                                {renderTaskGroup("No Date", groupedTasks.noDate)}
                                {showCompleted && renderTaskGroup("Completed", groupedTasks.completed, "text-gray-500")}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Dialogs */}
            <TaskForm
                open={isCreateDialogOpen || !!taskToEdit}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsCreateDialogOpen(false);
                        setTaskToEdit(null);
                    }
                }}
                task={taskToEdit}
                allUsers={allUsers}
                currentUserId={currentUser?._id}
                onSubmit={handleSubmitTask}
            />

            <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Task</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete this task? This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTask} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
