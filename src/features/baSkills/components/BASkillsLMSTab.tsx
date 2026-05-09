import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Clock, LoaderCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { USAGE_TYPE_LABEL } from "../lib/currency";

type BARecord = {
  _id: Id<"baRecords">;
  memberName: string;
  dateUsed: string;
  durationMinutes: number;
  usageType: "firecall" | "drill";
  verifierName: string;
  submitterName: string;
  submittedOnBehalf: boolean;
  lmsEnteredAt?: number;
  lmsEnteredByName?: string;
};

interface LMSRecordRowProps {
  record: BARecord;
  isUpdating: boolean;
  onSetEntered: (recordId: Id<"baRecords">, entered: boolean) => void;
}

function LMSRecordRow({ record, isUpdating, onSetEntered }: LMSRecordRowProps) {
  const isEntered = record.lmsEnteredAt !== undefined;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{record.memberName}</span>
            <Badge variant={record.usageType === "firecall" ? "destructive" : "secondary"}>
              {USAGE_TYPE_LABEL[record.usageType]}
            </Badge>
            {isEntered ? (
              <Badge variant="outline" className="gap-1 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                LMS entered
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Pending LMS
              </Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{format(new Date(record.dateUsed), "EEE, d MMM yyyy")}</span>
            <span>{record.durationMinutes} min on air</span>
            <span>Verified by {record.verifierName}</span>
          </div>

          <div className="mt-1 text-sm text-muted-foreground">
            Submitted {record.submittedOnBehalf ? `by ${record.submitterName}` : "by member"}
            {isEntered && record.lmsEnteredAt && (
              <>
                {" "}
                · LMS marked by {record.lmsEnteredByName ?? "Unknown"} on{" "}
                {format(new Date(record.lmsEnteredAt), "d MMM yyyy, h:mm a")}
              </>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant={isEntered ? "outline" : "default"}
          size="sm"
          disabled={isUpdating}
          onClick={() => onSetEntered(record._id, !isEntered)}
          className="w-full sm:w-auto"
        >
          {isUpdating ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : isEntered ? (
            <RotateCcw className="mr-2 h-4 w-4" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {isEntered ? "Mark pending" : "Mark entered"}
        </Button>
      </div>
    </div>
  );
}

export function BASkillsLMSTab() {
  const records = useQuery(api.baRecords.listRecords, {});
  const setLmsEntered = useMutation(api.baRecords.setLmsEntered);
  const [updatingRecordId, setUpdatingRecordId] = useState<Id<"baRecords"> | null>(null);

  const { pendingRecords, enteredRecords } = useMemo(() => {
    const list = records ?? [];
    return {
      pendingRecords: list.filter((record) => record.lmsEnteredAt === undefined),
      enteredRecords: list.filter((record) => record.lmsEnteredAt !== undefined),
    };
  }, [records]);

  const handleSetEntered = async (recordId: Id<"baRecords">, entered: boolean) => {
    setUpdatingRecordId(recordId);
    try {
      await setLmsEntered({ recordId, entered });
      toast.success(entered ? "Record marked as entered into LMS" : "Record moved back to pending");
    } catch (err) {
      console.error("Failed to update LMS status:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update LMS status");
    } finally {
      setUpdatingRecordId(null);
    }
  };

  if (records === undefined) {
    return (
      <div data-component="BASkillsLMSTab">
        <div className="mb-4 overflow-hidden rounded bg-white shadow-sm dark:bg-gray-800">
          <div className="flex items-center justify-center p-8">
            <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-component="BASkillsLMSTab">
      <div className="mb-4 overflow-hidden rounded bg-white shadow-sm dark:bg-gray-800">
        <div className="flex flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">LMS entry queue</h2>
              <p className="text-sm text-muted-foreground">
                {pendingRecords.length} pending · {enteredRecords.length} entered
              </p>
            </div>
          </div>

          <section className="flex flex-col gap-3" aria-labelledby="ba-lms-pending-heading">
            <h3 id="ba-lms-pending-heading" className="text-sm font-semibold text-foreground">
              Pending LMS entry
            </h3>
            {pendingRecords.length === 0 ? (
              <div className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-muted-foreground dark:border-gray-600">
                No BA records are waiting for LMS entry.
              </div>
            ) : (
              pendingRecords.map((record) => (
                <LMSRecordRow
                  key={record._id}
                  record={record}
                  isUpdating={updatingRecordId === record._id}
                  onSetEntered={handleSetEntered}
                />
              ))
            )}
          </section>

          {enteredRecords.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="ba-lms-entered-heading">
              <h3 id="ba-lms-entered-heading" className="text-sm font-semibold text-foreground">
                Entered into LMS
              </h3>
              {enteredRecords.map((record) => (
                <LMSRecordRow
                  key={record._id}
                  record={record}
                  isUpdating={updatingRecordId === record._id}
                  onSetEntered={handleSetEntered}
                />
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
