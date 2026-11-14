import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

import { BARecordCard } from "./BARecordCard";
import { BAMyCurrencyCard } from "./BAMyCurrencyCard";
import { isWithinBARecordDeleteWindow, useBARecordDeleteWindowNow } from "../lib/deletePermissions";
import { Spinner } from "@/components/ui/spinner";

const MY_RECORDS_LIMIT = 200;

interface BASkillsMyRecordsTabProps {
  canManageRecords?: boolean;
}

export function BASkillsMyRecordsTab({ canManageRecords = false }: BASkillsMyRecordsTabProps) {
  const records = useQuery(api.baRecords.listMyRecords, { limit: MY_RECORDS_LIMIT });
  const me = useQuery(api.baRecords.getCurrentUser);
  const now = useBARecordDeleteWindowNow();

  return (
    <div className="space-y-4" data-component="BASkillsMyRecordsTab">
      <BAMyCurrencyCard />

      {records === undefined || me === undefined ? (
        <div className="flex items-center justify-center p-6">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          No personal BA records yet. Use the Log tab to submit your first one.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {records.length === 1 ? "1 record" : `${records.length} records`}
          </p>
          {records.map((record) => (
            <BARecordCard
              key={record._id}
              record={record}
              canDelete={
                canManageRecords ||
                (!!me &&
                  record.submittedBy === me._id &&
                  isWithinBARecordDeleteWindow(record.createdAt, now))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
