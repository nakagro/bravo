import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChecklistActionBarProps {
  state: "editable" | "completed";
  primaryLabel: string;
  onPrimary: () => void;
  /** Hides the primary button entirely. */
  primaryDisabled?: boolean;
  isSubmitting?: boolean;
  completedLabel?: string;
}

/**
 * The sticky bottom chrome shared by every checklist screen: the primary
 * action, and nothing else. What's outstanding is reported once, by
 * `ChecklistProgressHeader` at the top — repeating it down here was noise.
 */
export function ChecklistActionBar({
  state,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  isSubmitting = false,
  completedLabel = "All checks completed",
}: ChecklistActionBarProps) {
  if (state === "editable" && primaryDisabled) return null;

  return (
    <div
      className="sticky bottom-0 z-10 pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent dark:from-gray-900 dark:via-gray-900/95"
      data-component="ChecklistActionBar"
    >
      {state === "completed" ? (
        <div className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-green-50/95 dark:bg-green-950/80 backdrop-blur border border-green-200 dark:border-green-800 text-sm font-medium text-green-700 dark:text-green-300 shadow-sm">
          <Check className="h-4 w-4" aria-hidden="true" />
          {completedLabel}
        </div>
      ) : (
        <Button
          onClick={onPrimary}
          disabled={isSubmitting}
          size="lg"
          className="w-full text-base font-medium bg-green-600 hover:bg-green-700 text-white shadow-sm"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Submitting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Check className="h-5 w-5" aria-hidden="true" />
              {primaryLabel}
            </span>
          )}
        </Button>
      )}
    </div>
  );
}
