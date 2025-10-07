import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface AdminTasksProps {
  showTitle?: boolean;
}

type TaskStatus = {
  status: "idle" | "running" | "success" | "error";
  count: number | null;
  message?: string;
};

export default function AdminTasks({ showTitle = true }: AdminTasksProps) {
  // Actions and mutations
  const deleteMessages = useAction(api.messages.deleteAllMessagesAction);
  const nightlyReset = useAction(api.availabilityActions.nightlyReset);
  const morningReminder = useAction(api.availabilityActions.morningReminder);
  const processTransitions = useMutation(api.availability.processStatusTransitions);
  const cleanupNotifications = useAction(api.notificationHistory.cleanupExpiredNotificationsAction);

  // Task statuses
  const [deleteMessagesStatus, setDeleteMessagesStatus] = useState<TaskStatus>({ status: "idle", count: null });
  const [resetStatus, setResetStatus] = useState<TaskStatus>({ status: "idle", count: null });
  const [reminderStatus, setReminderStatus] = useState<TaskStatus>({ status: "idle", count: null });
  const [transitionsStatus, setTransitionsStatus] = useState<TaskStatus>({ status: "idle", count: null });
  const [cleanupStatus, setCleanupStatus] = useState<TaskStatus>({ status: "idle", count: null });

  const handleDeleteMessages = async () => {
    try {
      setDeleteMessagesStatus({ status: "running", count: null });
      const count = await deleteMessages({});
      setDeleteMessagesStatus({ status: "success", count });
    } catch (err) {
      console.error(err);
      setDeleteMessagesStatus({ status: "error", count: null, message: String(err) });
    }
  };

  const handleReset = async () => {
    try {
      setResetStatus({ status: "running", count: null });
      const count = await nightlyReset({});
      setResetStatus({ status: "success", count });
    } catch (err) {
      console.error(err);
      setResetStatus({ status: "error", count: null, message: String(err) });
    }
  };

  const handleReminder = async () => {
    try {
      setReminderStatus({ status: "running", count: null });
      const count = await morningReminder({});
      setReminderStatus({ status: "success", count });
    } catch (err) {
      console.error(err);
      setReminderStatus({ status: "error", count: null, message: String(err) });
    }
  };

  const handleTransitions = async () => {
    try {
      setTransitionsStatus({ status: "running", count: null });
      const count = await processTransitions({});
      setTransitionsStatus({ status: "success", count });
    } catch (err) {
      console.error(err);
      setTransitionsStatus({ status: "error", count: null, message: String(err) });
    }
  };

  const handleCleanup = async () => {
    try {
      setCleanupStatus({ status: "running", count: null });
      const count = await cleanupNotifications({});
      setCleanupStatus({ status: "success", count });
    } catch (err) {
      console.error(err);
      setCleanupStatus({ status: "error", count: null, message: String(err) });
    }
  };

  const renderTaskButton = (
    label: string,
    onClick: () => void,
    taskStatus: TaskStatus,
    description: string,
    schedule: string
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{schedule}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{description}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClick}
          disabled={taskStatus.status === "running"}
          className="ml-4"
        >
          {taskStatus.status === "running" ? "Running..." : "Run Now"}
        </Button>
      </div>
      {taskStatus.status === "success" && (
        <p className="text-green-600 dark:text-green-400 text-xs">
          ✓ Done! {taskStatus.count !== null ? `${taskStatus.count} items processed.` : ""}
        </p>
      )}
      {taskStatus.status === "error" && (
        <p className="text-red-600 dark:text-red-400 text-xs">
          ✗ Error running task.
        </p>
      )}
    </div>
  );

  return (
    <Card className="dark:bg-gray-800">
      {showTitle && (
        <CardHeader>
          <CardTitle>Admin Tasks</CardTitle>
          <CardDescription>
            Manually trigger scheduled maintenance tasks and cron jobs
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {renderTaskButton(
          "Delete All Messages",
          handleDeleteMessages,
          deleteMessagesStatus,
          "Remove all availability messages from the database",
          "Scheduled: Daily at 4:00 AM AEST"
        )}
        
        <Separator />
        
        {renderTaskButton(
          "Nightly Status Reset",
          handleReset,
          resetStatus,
          "Reset all user availability statuses and send notifications",
          "Scheduled: Daily at 4:30 AM AEST"
        )}
        
        <Separator />
        
        {renderTaskButton(
          "Morning Availability Reminder",
          handleReminder,
          reminderStatus,
          "Send reminders to users who haven't set their availability status",
          "Scheduled: Daily at 10:00 AM AEST"
        )}
        
        <Separator />
        
        {renderTaskButton(
          "Process Status Transitions",
          handleTransitions,
          transitionsStatus,
          "Process automatic status transitions based on duration settings",
          "Scheduled: Every 5 minutes"
        )}
        
        <Separator />
        
        {renderTaskButton(
          "Cleanup Expired Notifications",
          handleCleanup,
          cleanupStatus,
          "Delete notification history entries older than 24 hours",
          "Scheduled: Every hour"
        )}
      </CardContent>
    </Card>
  );
}
