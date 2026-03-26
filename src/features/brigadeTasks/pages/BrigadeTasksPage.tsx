import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, CircleCheckBig, TriangleAlert, Clock, Users } from "lucide-react";

import { Task, TaskCard, TaskStatus, TaskPriority, TaskCategory } from "../components/TaskCard";
import { TaskFilters, FilterType } from "../components/TaskFilters";
import { TaskForm } from "../components/TaskForm";
import { QuickAddTask } from "../components/QuickAddTask";

type TabType = "my-tasks" | "created" | "brigade";

export function BrigadeTasksPage() {
    const [activeTab, setActiveTab] = useState<TabType>("my-tasks");
    const [showCompleted, setShowCompleted] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Id<"brigadeTasks"> | null>(null);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterType>("all");
    const [activeCategory, setActiveCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [quickAddText, setQuickAddText] = useState("");
    const [isQuickAdding, setIsQuickAdding] = useState(false);
    const [celebratingTaskId, setCelebratingTaskId] = useState<Id<"brigadeTasks"> | null>(null);

    const isMobile = useIsMobile();
    const { toast } = useToast();

    const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

    // Queries
    const myTasks = useQuery(api.brigadeTasks.getMyTasks, { includeCompleted: showCompleted });
    const createdTasks = useQuery(api.brigadeTasks.getTasksCreatedByMe, { includeCompleted: showCompleted });
    const allBrigadeTasks = useQuery(
        api.brigadeTasks.getAllTasks,
        activeTab === "brigade" ? { includeCompleted: showCompleted } : "skip"
    );
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

    // Get raw tasks for active tab
    const rawTasks = useMemo(() => {
        if (activeTab === "my-tasks") return myTasks;
        if (activeTab === "created") return createdTasks;
        return allBrigadeTasks;
    }, [activeTab, myTasks, createdTasks, allBrigadeTasks]);

    // Filter tasks
    const filteredTasks = useMemo(() => {
        if (!rawTasks) return undefined;

        let result = [...rawTasks];

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((t) =>
                t.title.toLowerCase().includes(q) ||
                t.description?.toLowerCase().includes(q) ||
                t.assigneeName?.toLowerCase().includes(q)
            );
        }

        // Status filter
        switch (activeFilter) {
            case "overdue":
                result = result.filter((t) => t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "cancelled");
                break;
            case "today":
                result = result.filter((t) => t.dueDate === today && t.status !== "completed" && t.status !== "cancelled");
                break;
        }

        // Category filter
        if (activeCategory !== "all") {
            result = result.filter((t) => t.category === activeCategory);
        }

        return result;
    }, [rawTasks, activeFilter, activeCategory, searchQuery, today]);

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
            if (!task.dueDate) groups.noDate.push(task);
            else if (task.dueDate < today) groups.overdue.push(task);
            else if (task.dueDate === today) groups.today.push(task);
            else if (task.dueDate === tomorrow) groups.tomorrow.push(task);
            else groups.upcoming.push(task);
        });

        return groups;
    }, [filteredTasks, today, tomorrow]);

    // Group brigade tasks by assignee
    const brigadeGrouped = useMemo(() => {
        if (activeTab !== "brigade" || !filteredTasks) return null;

        const byMember: Record<string, { name: string; tasks: Task[] }> = {};
        filteredTasks.forEach((task) => {
            const key = task.assignedTo;
            if (!byMember[key]) {
                byMember[key] = { name: task.assigneeName || "Unknown", tasks: [] };
            }
            byMember[key].tasks.push(task);
        });

        // Sort members by number of active tasks (most first)
        return Object.values(byMember).sort((a, b) => {
            const aActive = a.tasks.filter(t => t.status === "active").length;
            const bActive = b.tasks.filter(t => t.status === "active").length;
            return bActive - aActive;
        });
    }, [activeTab, filteredTasks]);

    // Filter counts
    const filterCounts = useMemo(() => {
        if (!rawTasks) return { today: 0, overdue: 0 };
        const active = rawTasks.filter(t => t.status !== "completed" && t.status !== "cancelled");
        return {
            today: active.filter(t => t.dueDate === today).length,
            overdue: active.filter(t => t.dueDate && t.dueDate < today).length,
        };
    }, [rawTasks, today]);

    // Stats for overview cards
    const stats = useMemo(() => {
        if (!myTasks) return { active: 0, overdue: 0, dueToday: 0 };
        const active = myTasks.filter(t => t.status !== "completed" && t.status !== "cancelled");
        return {
            active: active.length,
            overdue: active.filter(t => t.dueDate && t.dueDate < today).length,
            dueToday: active.filter(t => t.dueDate === today).length,
        };
    }, [myTasks, today]);

    // Handlers
    const handleQuickAdd = async () => {
        if (!quickAddText.trim()) return;
        setIsQuickAdding(true);
        try {
            await createTask({ title: quickAddText.trim() });
            setQuickAddText("");
            toast({ title: "Task added!", description: "Your task has been created" });
        } catch {
            toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
        } finally {
            setIsQuickAdding(false);
        }
    };

    const handleSubmitTask = async (data: {
        title: string;
        description: string;
        dueDate: string;
        assignedTo: string;
        priority: TaskPriority;
        category: string;
    }) => {
        const priority = data.priority;
        const category = data.category === "none" ? undefined : (data.category as TaskCategory);

        if (taskToEdit) {
            await updateTask({
                taskId: taskToEdit._id,
                title: data.title,
                description: data.description || undefined,
                dueDate: data.dueDate || undefined,
                assignedTo: data.assignedTo === "self" ? currentUser?._id : (data.assignedTo as Id<"users">),
                priority,
                category,
            });
            toast({ title: "Task updated", description: "Your changes have been saved" });
            setTaskToEdit(null);
        } else {
            await createTask({
                title: data.title,
                description: data.description || undefined,
                dueDate: data.dueDate || undefined,
                assignedTo: data.assignedTo === "self" ? undefined : (data.assignedTo as Id<"users">),
                priority,
                category,
            });
            toast({ title: "Task created", description: data.assignedTo !== "self" ? "Task assigned successfully" : "Your task has been added" });
        }
    };

    const handleStatusChange = async (taskId: Id<"brigadeTasks">, newStatus: TaskStatus) => {
        try {
            if (newStatus === "completed") {
                setCelebratingTaskId(taskId);
                setTimeout(() => setCelebratingTaskId(null), 1000);
                toast({ title: "Task completed!", description: "Great job getting that done!" });
            }
            await updateTaskStatus({ taskId, status: newStatus });
        } catch {
            toast({ title: "Error", description: "Failed to update task status", variant: "destructive" });
        }
    };

    const handleDeleteTask = async () => {
        if (!taskToDelete) return;
        try {
            await deleteTask({ taskId: taskToDelete });
            toast({ title: "Task deleted", description: "The task has been removed" });
            setTaskToDelete(null);
        } catch {
            toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
        }
    };

    const getIndicatorStyle = () => {
        const el = tabRefs.current[activeTab];
        return el ? { left: el.offsetLeft, width: el.offsetWidth } : { left: 0, width: 0 };
    };

    const isLoading = filteredTasks === undefined;

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
                            showAssignee={activeTab === "created" || activeTab === "brigade"}
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

    const tabs: { id: TabType; label: string; badge?: number; icon?: React.ReactNode }[] = [
        { id: "my-tasks", label: "My Tasks", badge: taskCounts?.myTasks, icon: undefined },
        { id: "created", label: "Created", icon: undefined },
        { id: "brigade", label: "Brigade", icon: <Users className="h-3.5 w-3.5" /> },
    ];

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

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-3">
                <div className={`p-3 rounded-xl border transition-all ${
                    stats.active > 0
                        ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                }`}>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-900/30">
                            <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.active}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                </div>
                <div className={`p-3 rounded-xl border transition-all ${
                    stats.overdue > 0
                        ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                }`}>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1 rounded-md bg-red-100 dark:bg-red-900/30">
                            <TriangleAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        </div>
                    </div>
                    <p className={`text-xl font-bold ${stats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>{stats.overdue}</p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                </div>
                <div className={`p-3 rounded-xl border transition-all ${
                    stats.dueToday > 0
                        ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                }`}>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1 rounded-md bg-amber-100 dark:bg-amber-900/30">
                            <CircleCheckBig className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                    <p className={`text-xl font-bold ${stats.dueToday > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}`}>{stats.dueToday}</p>
                    <p className="text-xs text-muted-foreground">Due Today</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 relative">
                <nav className="flex gap-x-1 -mb-px">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            ref={(el) => { tabRefs.current[tab.id] = el; }}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-2.5 px-3 text-sm transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                                activeTab === tab.id
                                    ? "text-red-600 dark:text-red-400 font-bold"
                                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                            {tab.badge !== undefined && tab.badge > 0 && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 font-semibold">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
                <div
                    className="absolute bottom-0 h-0.5 bg-red-500 dark:bg-red-400 transition-all duration-300 ease-out"
                    style={getIndicatorStyle()}
                />
            </div>

            {/* Quick Add + Filters */}
            <div className="space-y-2">
                <QuickAddTask
                    quickAddText={quickAddText}
                    isQuickAdding={isQuickAdding}
                    onTextChange={setQuickAddText}
                    onSubmit={handleQuickAdd}
                />
                <TaskFilters
                    activeFilter={activeFilter}
                    filterCounts={filterCounts}
                    showCompleted={showCompleted}
                    onFilterChange={setActiveFilter}
                    onShowCompletedChange={setShowCompleted}
                    activeCategory={activeCategory}
                    onCategoryChange={setActiveCategory}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
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
                    <div className="bg-white dark:bg-gray-800 shadow-sm p-6 text-center rounded-lg">
                        <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                            <CircleCheckBig className="h-6 w-6 text-gray-400" />
                        </div>
                        <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                            {searchQuery
                                ? "No matching tasks"
                                : activeFilter !== "all" || activeCategory !== "all"
                                    ? "No matching tasks"
                                    : activeTab === "my-tasks"
                                        ? "You're all caught up!"
                                        : activeTab === "brigade"
                                            ? "No brigade tasks yet"
                                            : "No tasks created yet"
                            }
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            {searchQuery
                                ? "Try a different search term"
                                : activeFilter !== "all" || activeCategory !== "all"
                                    ? "Try adjusting your filters"
                                    : activeTab === "brigade"
                                        ? "Tasks created by any member will appear here"
                                        : "Use the quick add above or tap New Task"
                            }
                        </p>
                    </div>
                ) : activeTab === "brigade" && brigadeGrouped ? (
                    // Brigade view: grouped by member
                    <div className="space-y-6">
                        {brigadeGrouped.map((group) => (
                            <div key={group.name}>
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                        {group.name.charAt(0).toUpperCase()}
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{group.name}</h3>
                                    <span className="text-xs text-muted-foreground">
                                        {group.tasks.filter(t => t.status === "active").length} active
                                    </span>
                                </div>
                                <div className="space-y-0">
                                    {group.tasks.map(task => (
                                        <TaskCard
                                            key={task._id}
                                            task={task}
                                            currentUserId={currentUser?._id}
                                            showAssignee={false}
                                            isCelebrating={celebratingTaskId === task._id}
                                            onStatusChange={handleStatusChange}
                                            onEdit={setTaskToEdit}
                                            onDelete={setTaskToDelete}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // Standard grouped view
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
