import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CircleCheck, AlertCircle } from "lucide-react";
import { errorMessage as describeError } from "@/lib/errors";

type UpdateStatus = "idle" | "updating" | "success" | "error";

export function ForceUpdateButton() {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleForceUpdate = async () => {
    setStatus("updating");
    setErrorMessage("");

    try {
      // Step 1: Unregister all service workers
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        console.log("All service workers unregistered");
      }

      // Step 2: Clear all caches
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
        console.log("All caches cleared:", cacheNames);
      }

      // Step 3: Clear localStorage PWA-related items (optional, preserves user data)
      // We don't clear all localStorage to preserve user preferences

      setStatus("success");

      // Step 4: Reload the page after a brief delay to show success state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Force update failed:", error);
      setStatus("error");
      setErrorMessage(
        describeError(error, "Unknown error occurred")
      );
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Update
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        If the app isn't behaving correctly or you want to ensure you have the
        latest version, use this button to force a complete refresh, this will clear cached data and reload the app.
      </p>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleForceUpdate}
          disabled={status === "updating" || status === "success"}
          variant={status === "error" ? "destructive" : "outline"}
          className="flex items-center gap-2"
        >
          {status === "updating" ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : status === "success" ? (
            <>
              <CircleCheck className="h-4 w-4" />
              Reloading...
            </>
          ) : status === "error" ? (
            <>
              <AlertCircle className="h-4 w-4" />
              Retry Update
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Force Update
            </>
          )}
        </Button>

        {status === "success" && (
          <span className="text-sm text-green-600 dark:text-green-400">
            Update successful! Reloading...
          </span>
        )}
      </div>

      {status === "error" && errorMessage && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
