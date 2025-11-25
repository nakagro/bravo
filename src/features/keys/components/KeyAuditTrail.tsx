import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Pencil, Plus, Trash2 } from "lucide-react";

const actionIcons = {
  "key_created": Plus,
  "field_change": Pencil,
  "key_deleted": Trash2,
};

const actionColors = {
  "key_created": "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  "field_change": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300", 
  "key_deleted": "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function KeyAuditTrail() {
  const recentChanges = useQuery(api.keyAuditTrail.getRecentChanges, { limit: 20 });

  if (!recentChanges) {
    return (
      <div className="space-y-4">
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
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
          <Clock className="h-10 w-10 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No changes yet</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">
          Changes to keys will appear here as they happen.
        </p>
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
      'pegNumber': 'Peg Number',
      'siteName': 'Site Name',
      'address': 'Address',
      'contactName': 'Contact Name',
      'contactEmail': 'Contact Email',
      'contactPhone': 'Contact Phone',
      'notes': 'Notes',
      'deleted': 'Deleted',
    };
    return fieldNameMap[field] || field.charAt(0).toUpperCase() + field.slice(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          Last {recentChanges.length} changes
        </Badge>
      </div>

      <div className="space-y-2">
        {recentChanges.map((entry) => {
          const ActionIcon = actionIcons[entry.changeType as keyof typeof actionIcons] || Pencil;
          const actionColorClass = actionColors[entry.changeType as keyof typeof actionColors] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
          
          return (
            <div key={entry._id} className="bg-card border border-border rounded-lg p-3 hover:shadow-sm transition-shadow">
              {/* Header Row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ActionIcon className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                  <Badge className={`${actionColorClass} text-xs px-2 py-0.5`}>
                    {formatChangeType(entry.changeType)}
                  </Badge>
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    Peg {entry.keyPegNumber}
                  </span>
                  {entry.keySiteName && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      ({entry.keySiteName})
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {formatDate(entry.timestamp)}
                </span>
              </div>
              
              {/* Change Details Row */}
              {entry.changeType !== 'key_deleted' && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-gray-600 dark:text-gray-400 text-xs">{formatFieldName(entry.field)}:</span>
                    <span className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-xs truncate">
                      {formatValue(entry.oldValue)}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">→</span>
                    <span className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-xs truncate">
                      {formatValue(entry.newValue)}
                    </span>
                  </div>
                </div>
              )}
              
              {/* User and Notes Row (if present) */}
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span className="truncate">{entry.userName || entry.userEmail || 'Unknown User'}</span>
                </div>
                {entry.notes && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 truncate ml-2" title={entry.notes}>
                    📝 {entry.notes.length > 30 ? entry.notes.substring(0, 30) + '...' : entry.notes}
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
              Showing the most recent 20 changes. Older changes are available in individual key history.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
