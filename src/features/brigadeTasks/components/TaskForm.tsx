import { useState, useEffect } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { LoaderCircle, User } from "lucide-react";
import { Task } from "./TaskCard";

interface UserInfo {
    _id: Id<"users">;
    firstName?: string;
    lastName?: string;
    name?: string;
    rank?: string;
}

interface TaskFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: Task | null;
    allUsers?: UserInfo[];
    currentUserId?: Id<"users">;
    onSubmit: (data: {
        title: string;
        description: string;
        dueDate: string;
        assignedTo: string;
    }) => Promise<void>;
}

export function TaskForm({
    open,
    onOpenChange,
    task,
    allUsers,
    currentUserId,
    onSubmit,
}: TaskFormProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [assignedTo, setAssignedTo] = useState<string>("self");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isEditing = !!task;

    // Reset form when dialog opens/closes or task changes
    useEffect(() => {
        if (open) {
            if (task) {
                setTitle(task.title);
                setDescription(task.description || "");
                setDueDate(task.dueDate || "");
                setAssignedTo(task.assignedTo === currentUserId ? "self" : task.assignedTo);
            } else {
                setTitle("");
                setDescription("");
                setDueDate("");
                setAssignedTo("self");
            }
        }
    }, [open, task, currentUserId]);

    const getUserDisplayName = (user: UserInfo) => {
        if (user.firstName || user.lastName) {
            return `${user.firstName || ""} ${user.lastName || ""}`.trim();
        }
        return user.name || "Unknown";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                title: title.trim(),
                description: description.trim(),
                dueDate,
                assignedTo,
            });
            onOpenChange(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Edit Task" : "Create New Task"}</DialogTitle>
                        <DialogDescription>
                            {isEditing ? "Update your task details below." : "Add a new task to track your brigade activities."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title *</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="What needs to be done?"
                                autoFocus
                                className="h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add more details..."
                                rows={3}
                                className="min-h-[80px]"
                            />
                        </div>

                        {/* Due Date */}
                        <div className="space-y-2">
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input
                                id="dueDate"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                min={new Date().toISOString().split("T")[0]}
                                className="h-12"
                            />
                        </div>

                        {/* Assign to member */}
                        <div className="space-y-2">
                            <Label htmlFor="assignedTo">Assign to</Label>
                            <Select value={assignedTo} onValueChange={setAssignedTo}>
                                <SelectTrigger className="h-12">
                                    <SelectValue placeholder="Select a member" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="self">
                                        <span className="flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            Myself
                                        </span>
                                    </SelectItem>
                                    {allUsers?.filter(u => u._id !== currentUserId).map((user) => (
                                        <SelectItem key={user._id} value={user._id}>
                                            <span className="flex items-center gap-2">
                                                <User className="h-4 w-4 opacity-50" />
                                                {getUserDisplayName(user)}
                                                {user.rank && <span className="text-xs text-muted-foreground">({user.rank})</span>}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none h-11">
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none h-11">
                                {isSubmitting ? (
                                    <>
                                        <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                                        {isEditing ? "Saving..." : "Creating..."}
                                    </>
                                ) : (
                                    isEditing ? "Save Changes" : "Create Task"
                                )}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
