import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ClockIcon,
  UserIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

const actionIcons = {
  "fault_created": PlusIcon,
  "field_change": PencilSquareIcon,
  "fault_deleted": TrashIcon,
};

const actionColors = {
  "fault_created": "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  "field_change": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300", 
  "fault_deleted": "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function VehicleFaultAuditTrail() {
  const recentChanges = useQuery(api.vehicleFaultAuditTrail.getRecentChanges, { limit: 20 });

  if (!recentChanges) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <ClockIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Audit Trail</h2>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (recentChanges.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <ClockIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Audit Trail</h2>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <ClockIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No recent changes found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
      // Check if it's a timestamp (likely > 1000000000000)
      if (value > 1000000000000) {
        return new Date(value).toLocaleDateString();
      }
      return String(value);
    }
    return String(value);
  };

  const formatChangeType = (changeType: string) => {
    return changeType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatFieldName = (field: string) => {
    const fieldNameMap: Record<string, string> = {
      'dateReported': 'Date Reported',
      'dateLogged': 'Date Logged',
      'vehicle': 'Vehicle',
      'shortDescription': 'Short Description',
      'longDescription': 'Long Description',
      'eamRequestNumber': 'EAM Request Number',
      'priority': 'Priority',
      'status': 'Status',
      'notes': 'Notes',
      'created': 'Created',
      'deleted': 'Deleted',
    };
    return fieldNameMap[field] || field.charAt(0).toUpperCase() + field.slice(1);
  };

  const formatPriority = (priority: string) => {
    const priorityMap: Record<string, string> = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
    };
    return priorityMap[priority] || priority;
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending_dmo': 'Pending - DMO',
      'pending_wydv': 'Pending - WYDV',
      'resolved': 'Resolved',
    };
    return statusMap[status] || status;
  };

  const formatFieldValue = (field: string, value: any) => {
    if (field === 'priority') return formatPriority(value);
    if (field === 'status') return formatStatus(value);
    return formatValue(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <ClockIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Audit Trail</h2>
        <Badge variant="secondary" className="ml-2">
          Last {recentChanges.length} changes
        </Badge>
      </div>

      <div className="space-y-2">
        {recentChanges.map((entry) => {
          const ActionIcon = actionIcons[entry.changeType as keyof typeof actionIcons] || PencilSquareIcon;
          const actionColorClass = actionColors[entry.changeType as keyof typeof actionColors] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
          
          // Check if this is a long text field
          const isLongTextField = ['longDescription', 'shortDescription', 'notes'].includes(entry.field);
          const oldValueStr = formatFieldValue(entry.field, entry.oldValue);
          const newValueStr = formatFieldValue(entry.field, entry.newValue);
          const isLongChange = isLongTextField || oldValueStr.length > 50 || newValueStr.length > 50;
          
          return (
            <div key={entry._id} className="bg-card border border-border rounded-lg p-3 hover:shadow-sm transition-shadow">
              {/* Header Row - Stack on mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <ActionIcon className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                  <Badge className={`${actionColorClass} text-xs px-2 py-0.5 flex-shrink-0`}>
                    {formatChangeType(entry.changeType)}
                  </Badge>
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm flex-shrink-0">
                    {entry.faultVehicle}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    ({entry.faultShortDescription})
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 sm:ml-2">
                  {formatDate(entry.timestamp)}
                </span>
              </div>
              
              {/* Change Details - Stack vertically for long text, horizontal for short */}
              {entry.changeType !== 'fault_deleted' && entry.changeType !== 'fault_created' && (
                <div className="text-sm">
                  <div className="mb-1">
                    <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">{formatFieldName(entry.field)}:</span>
                  </div>
                  {isLongChange ? (
                    // Stack vertically for long text
                    <div className="space-y-2">
                      <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 px-2 py-1.5 rounded text-xs break-words">
                        <div className="font-medium mb-0.5">Old:</div>
                        <div className="line-clamp-3">{oldValueStr}</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-1.5 rounded text-xs break-words">
                        <div className="font-medium mb-0.5">New:</div>
                        <div className="line-clamp-3">{newValueStr}</div>
                      </div>
                    </div>
                  ) : (
                    // Horizontal layout for short text
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-xs break-words max-w-full">
                        {oldValueStr}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">→</span>
                      <span className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-xs break-words max-w-full">
                        {newValueStr}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* User and Notes Row - Stack on mobile if notes present */}
              <div className={`flex ${entry.notes ? 'flex-col sm:flex-row sm:items-center' : 'flex-row items-center'} ${entry.notes ? 'gap-1 sm:justify-between' : 'justify-between'} mt-2 text-xs text-gray-500 dark:text-gray-400`}>
                <div className="flex items-center gap-1 min-w-0">
                  <UserIcon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{entry.userName || entry.userEmail || 'Unknown User'}</span>
                </div>
                {entry.notes && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 line-clamp-2 break-words" title={entry.notes}>
                    📝 {entry.notes}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {recentChanges.length === 20 && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing the most recent 20 changes. Older changes are available in individual fault history.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
