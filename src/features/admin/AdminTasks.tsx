import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";

interface AdminTasksProps {
  showTitle?: boolean;
}

export default function AdminTasks({ showTitle = true }: AdminTasksProps) {
  const nightlyReset = useAction(api.availabilityResetAction.nightlyReset);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">(
    "idle"
  );
  const [resultCount, setResultCount] = useState<number | null>(null);

  const handleReset = async () => {
    try {
      setStatus("running");
      const count = await nightlyReset({});
      setResultCount(count);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded shadow space-y-4">
      {showTitle && (
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          Admin Tasks
        </h2>
      )}

      <div className="space-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Run maintenance tasks manually.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="accent"
            onClick={handleReset}
            disabled={status === "running"}
          >
            {status === "running" ? "Running..." : "Run Availability Reset"}
          </Button>
          {status === "success" && (
            <span className="text-green-600 dark:text-green-400 text-sm">
              Done! {resultCount} user(s) notified.
            </span>
          )}
          {status === "error" && (
            <span className="text-red-600 dark:text-red-400 text-sm">
              Error running task.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
