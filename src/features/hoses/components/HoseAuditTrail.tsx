import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ClockIcon,
  UserIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const actionIcons = {
  "hose_created": PlusIcon,
  "hose_updated": PencilSquareIcon,
  "hose_replaced": ArrowPathIcon,
  "hose_deleted": TrashIcon,
  "status_change": ArrowPathIcon,
  "size_change": PencilSquareIcon,
  "length_change": PencilSquareIcon,
  "type_change": PencilSquareIcon,
  "test_date_change": ClockIcon,
};

const actionColors = {
  "hose_created": "bg-green-100 text-green-800",
  "hose_updated": "bg-blue-100 text-blue-800", 
  "hose_replaced": "bg-orange-100 text-orange-800",
  "hose_deleted": "bg-red-100 text-red-800",
  "status_change": "bg-purple-100 text-purple-800",
  "size_change": "bg-blue-100 text-blue-800",
  "length_change": "bg-blue-100 text-blue-800",
  "type_change": "bg-blue-100 text-blue-800",
  "test_date_change": "bg-indigo-100 text-indigo-800",
};

export function HoseAuditTrail() {
  const recentChanges = useQuery(api.hoseAuditTrail.getRecentChanges, { limit: 20 });

  if (!recentChanges) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <ClockIcon className="h-6 w-6 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Audit Trail</h2>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
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
          <ClockIcon className="h-6 w-6 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Audit Trail</h2>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent changes found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'null';
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <ClockIcon className="h-6 w-6 text-gray-600" />
        <h2 className="text-xl font-semibold text-gray-900">Audit Trail</h2>
        <Badge variant="secondary" className="ml-2">
          Last {recentChanges.length} changes
        </Badge>
      </div>

      <div className="space-y-2">
        {recentChanges.map((entry) => {
          const ActionIcon = actionIcons[entry.changeType as keyof typeof actionIcons] || PencilSquareIcon;
          const actionColorClass = actionColors[entry.changeType as keyof typeof actionColors] || "bg-gray-100 text-gray-800";
          
          return (
            <div key={entry._id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
              {/* Header Row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ActionIcon className="h-4 w-4 text-gray-600 flex-shrink-0" />
                  <Badge className={`${actionColorClass} text-xs px-2 py-0.5`}>
                    {formatChangeType(entry.changeType)}
                  </Badge>
                  <span className="font-medium text-gray-900 text-sm">
                    {(entry as any).hoseIdString}
                  </span>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatDate(entry.timestamp)}
                </span>
              </div>
              
              {/* Change Details Row */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-gray-600 text-xs">{entry.field}:</span>
                  <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs truncate">
                    {formatValue(entry.oldValue)}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs truncate">
                    {formatValue(entry.newValue)}
                  </span>
                </div>
              </div>
              
              {/* User and Notes Row (if present) */}
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <UserIcon className="h-3 w-3" />
                  <span className="truncate">{entry.userName || entry.userEmail || 'Unknown User'}</span>
                </div>
                {entry.notes && (
                  <span className="text-xs text-blue-600 truncate ml-2" title={entry.notes}>
                    📝 {entry.notes.length > 20 ? entry.notes.substring(0, 20) + '...' : entry.notes}
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
            <p className="text-sm text-gray-500">
              Showing the most recent 20 changes. Older changes are available in individual hose history.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
