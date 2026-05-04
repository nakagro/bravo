import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { LoaderCircle } from "lucide-react";
import { BARecordCard } from "./BARecordCard";

export function BASkillsMyRecordsTab() {
  const records = useQuery(api.baRecords.listMyRecords, {});
  const me = useQuery(api.baRecords.getCurrentUser);

  return (
    <div data-component="BASkillsMyRecordsTab">
      <div className="mb-4 bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
        <div className="px-3 py-3">
          {records === undefined || me === undefined ? (
            <div className="flex items-center justify-center p-6">
              <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No personal BA records yet. Use the Log tab to submit your first one.
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <BARecordCard
                  key={record._id}
                  record={record}
                  canDelete={!!me && record.submittedBy === me._id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
