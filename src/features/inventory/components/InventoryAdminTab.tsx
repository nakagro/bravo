import { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { getRelativeTimeString } from "../../../utils/dateUtils";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { NotificationRecipientsSection } from "@/components/shared/NotificationRecipientsSection";
import {
  Clock,
  Inbox,
  Archive,
  ExternalLink,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface InventoryAdminTabProps {
  isAuthenticated: boolean;
}

export function InventoryAdminTab({ isAuthenticated }: InventoryAdminTabProps) {
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<{
    runId: Id<"applianceCheckRuns">;
    templateName: string;
  } | null>(null);

  const recentRuns = useQuery(api.inventoryCheckRuns.listRunSummaries, { limit: 50 });
  const deleteRun = useMutation(api.inventoryCheckRuns.deleteRun);

  // Format user display name
  const formatUserName = (user: { firstName?: string; lastName?: string; name?: string } | null | undefined) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user?.name) {
      return user.name;
    } else {
      return "Unknown User";
    }
  };

  const handleDeleteRun = async (runId: Id<"applianceCheckRuns">) => {
    try {
      await deleteRun({ runId });
      toast.success('Inventory check deleted');
    } catch (error) {
      console.error('Error deleting run:', error);
      toast.error('Failed to delete inventory check', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200';
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'cancelled':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">Please log in to access admin features.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <NotificationRecipientsSection
        conditionKey="inventory:checkCompleted"
        moduleId="inventory"
        url="/inventory?tab=history"
        title="Inventory check completed"
        description="Tell the people who hold the equipment portfolio when an inventory check is completed, including anything missing, miscounted or left unchecked."
      />

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium flex items-center">
          <Archive className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
          Manage Inventory Checks
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400 font-normal">
            (Last 50)
          </span>
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Delete old or cancelled inventory checks to clean up the history.
        </p>
      </div>
      
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {!recentRuns || recentRuns.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-10 w-10 text-red-500 dark:text-red-400" />}
            title="No inventory checks yet"
            description="Completed and in-progress checks will appear here once someone starts one."
          />
        ) : (
          recentRuns.map((summary) => {
            const { run, total, yes, no, unanswered, startedByUser } = summary;
            const startDate = run.startedAt ? new Date(run.startedAt) : null;
            
            return (
              <div key={run._id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Date badge */}
                  {startDate && (
                    <div className="text-center min-w-[50px] bg-gray-100 dark:bg-gray-700 rounded-lg py-1.5 px-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {startDate.toLocaleDateString('en-AU', { weekday: 'short' })}
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">{startDate.getDate()}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                        {startDate.toLocaleDateString('en-AU', { month: 'short' })}
                      </div>
                    </div>
                  )}

                  {/* Run details */}
                  <div className="flex-1 min-w-0">
                    {/* Template name and status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white">{run.templateName}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusBadgeClasses(run.status)}`}>
                        {getStatusIcon(run.status)}
                        {run.status === 'in_progress' ? 'In Progress' : run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                      </span>
                    </div>

                    {/* Progress info */}
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                      <span className="text-green-600 dark:text-green-400">{yes} yes</span>
                      <span className="text-red-600 dark:text-red-400">{no} no</span>
                      {unanswered > 0 && (
                        <span className="text-gray-500 dark:text-gray-400">{unanswered} unanswered</span>
                      )}
                      <span className="text-gray-400 dark:text-gray-500">({total} total)</span>
                    </div>

                    {/* User info */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      <span className="font-medium">Started by:</span> {formatUserName(startedByUser)}
                      {run.startedAt && (
                        <>
                          <span className="mx-1.5">•</span>
                          {getRelativeTimeString(run.startedAt)}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/inventory/run/${run._id}`)}
                      className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      <span className="hidden sm:inline">View</span>
                    </button>
                    <button
                      onClick={() => setPendingDelete({ runId: run._id, templateName: run.templateName })}
                      className="px-2 py-1.5 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete inventory check?"
        description={`This permanently deletes the inventory check for "${pendingDelete?.templateName ?? ""}". This action cannot be undone.`}
        onConfirm={() => {
          if (!pendingDelete) return;
          const { runId } = pendingDelete;
          setPendingDelete(null);
          void handleDeleteRun(runId);
        }}
      />
    </div>
  );
}
