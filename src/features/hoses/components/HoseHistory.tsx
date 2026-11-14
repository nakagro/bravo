import React from 'react';
import { useQuery } from "convex/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatDateTime } from "@/lib/dateFormat";

export function HoseHistory({ hoseId }: { hoseId: Id<"hoses"> }) {
  const history = useQuery(api.hoses.getHistory, { hoseId });
  const hoses = useQuery(api.hoses.list, {});
  const hose = hoses?.find(h => h._id === hoseId);
  
  // Check if the hose has been replaced
  const hasBeenReplaced = hose?.replacedAt !== undefined;
  
  // Format the history entries for display
  const formatHistoryEntry = (entry: any) => {
    const date = formatDateTime(entry.timestamp);
    
    // Special handling for hose replacement
    if (entry.changeType === 'hose_replacement') {
      return (
        <div key={entry._id} className="border-b border-border pb-3 mb-3 last:border-0 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
          <p className="text-sm text-gray-500 dark:text-gray-400">{date} by {entry.user.name}</p>
          <p className="font-medium text-blue-800 dark:text-blue-300">
            Hose was replaced with a new hose
          </p>
          {entry.notes && entry.notes !== "Hose was replaced" && (
            <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
              Note: {entry.notes}
            </p>
          )}
        </div>
      );
    }
    
    // Regular field changes
    let fieldDisplay = entry.field.charAt(0).toUpperCase() + entry.field.slice(1);
    
    // Format values based on field type
    let oldValueDisplay = entry.oldValue;
    let newValueDisplay = entry.newValue;
    
    if (entry.field === 'testDate') {
      oldValueDisplay = formatDate(entry.oldValue);
      newValueDisplay = formatDate(entry.newValue);
    }
    
    return (
      <div key={entry._id} className="border-b border-border pb-3 mb-3 last:border-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{date} by {entry.user.name}</p>
        <p className="dark:text-gray-200">
          Changed <span className="font-medium">{fieldDisplay}</span> from{' '}
          <span className="font-medium">{oldValueDisplay}</span> to{' '}
          <span className="font-medium">{newValueDisplay}</span>
        </p>
      </div>
    );
  };
  
  return (
    <div>
      {hasBeenReplaced && hose?.replacedAt && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            This hose was marked as replaced on {formatDate(hose.replacedAt)}.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="mt-2">
        {history ? (
          history.length > 0 ? (
            <div className="space-y-2">
              {history.map(formatHistoryEntry)}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No history available for this hose</p>
          )
        ) : (
          <div className="flex justify-center py-8">
            <Spinner className="size-8 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
