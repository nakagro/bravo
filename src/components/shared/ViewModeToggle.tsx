import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "cards" | "table";

interface ViewModeToggleProps {
  storageKey: string;
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

/** Returns a sensible default based on viewport width. */
export function getDefaultViewMode(): ViewMode {
  if (typeof window !== "undefined") {
    return window.innerWidth < 768 ? "cards" : "table";
  }
  return "cards";
}

/** Reads saved preference from localStorage, falling back to device default. */
export function getSavedViewMode(storageKey: string): ViewMode {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(storageKey);
    if (saved === "table" || saved === "cards") return saved;
  }
  return getDefaultViewMode();
}

export function ViewModeToggle({ storageKey, value, onChange }: ViewModeToggleProps) {
  // Persist preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, value);
    }
  }, [storageKey, value]);

  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border" role="group" aria-label="Inventory view">
      <Button
        type="button"
        onClick={() => onChange("cards")}
        variant={value === "cards" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "min-h-11 touch-manipulation rounded-r-none px-3",
          value === "cards" && "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
        )}
        aria-label="Card view"
        aria-pressed={value === "cards"}
      >
        <LayoutGrid data-icon="inline-start" aria-hidden="true" />
        <span className="hidden sm:inline">Cards</span>
      </Button>
      <Button
        type="button"
        onClick={() => onChange("table")}
        variant={value === "table" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "min-h-11 touch-manipulation rounded-l-none px-3",
          value === "table" && "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
        )}
        aria-label="Table view"
        aria-pressed={value === "table"}
      >
        <List data-icon="inline-start" aria-hidden="true" />
        <span className="hidden sm:inline">Table</span>
      </Button>
    </div>
  );
}
