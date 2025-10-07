import React from 'react';
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export function KeyHistory({ keyId }: { keyId: Id<"keys"> }) {
  const history = useQuery(api.keys.getHistory, { keyId });
  
  // Format the history entries for display
  const formatHistoryEntry = (entry: any) => {
    const date = new Date(entry.timestamp).toLocaleString();
    
    // Special handling for key deletion
    if (entry.changeType === 'key_deleted') {
      return (
        <div key={entry._id} className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-3 last:border-0 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          <p className="text-sm text-gray-500 dark:text-gray-400">{date} by {entry.user.name}</p>
          <p className="font-medium text-red-800 dark:text-red-300">
            Key was deleted
          </p>
          {entry.notes && (
            <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
              {entry.notes}
            </p>
          )}
        </div>
      );
    }
    
    // Regular field changes
    let fieldDisplay = entry.field.charAt(0).toUpperCase() + entry.field.slice(1);
    
    // Make field names more readable
    const fieldNameMap: Record<string, string> = {
      'pegNumber': 'Peg Number',
      'siteName': 'Site Name',
      'address': 'Address',
      'contactName': 'Contact Name',
      'contactEmail': 'Contact Email',
      'contactPhone': 'Contact Phone',
      'notes': 'Notes',
    };
    
    fieldDisplay = fieldNameMap[entry.field] || fieldDisplay;
    
    // Format values
    let oldValueDisplay = entry.oldValue || '(empty)';
    let newValueDisplay = entry.newValue || '(empty)';
    
    return (
      <div key={entry._id} className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-3 last:border-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{date} by {entry.user.name}</p>
        <p className="text-gray-900 dark:text-gray-200">
          Changed <span className="font-medium">{fieldDisplay}</span> from{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{oldValueDisplay}</span> to{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{newValueDisplay}</span>
        </p>
      </div>
    );
  };
  
  return (
    <div className="mt-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Change History</h3>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        {history ? (
          history.length > 0 ? (
            <div className="space-y-2">
              {history.map(formatHistoryEntry)}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No history available for this key</p>
          )
        ) : (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-red-700 dark:border-red-500 rounded-full border-t-transparent"></div>
          </div>
        )}
      </div>
    </div>
  );
}
