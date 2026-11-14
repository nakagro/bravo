import { ConvexError } from "convex/values";
import { toast } from "sonner";

/**
 * The text to show a member for a failed call. Strips Convex's
 * "[CONVEX M(...)] ... Uncaught Error:" wrapper and the stack trace, and reads
 * a ConvexError's string or `{ message }` data. Falls back when there is nothing
 * readable.
 */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "string" && data) return data;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string" && data.message) {
      return data.message;
    }
  }
  if (!(error instanceof Error)) return fallback;
  const match = /Uncaught (?:Convex)?Error: (.*)/.exec(error.message);
  const text = (match ? match[1] : error.message.split("\n")[0]).trim();
  return text || fallback;
}

/** Report a failed call with the standard error toast. */
export function toastError(error: unknown, fallback?: string): void {
  toast.error(errorMessage(error, fallback));
}
