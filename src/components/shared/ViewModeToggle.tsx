import { useState, useEffect } from "react";
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
    <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
      <Button
        onClick={() => onChange("cards")}
        variant={value === "cards" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "flex items-center rounded-r-none",
          value === "cards" && "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
        )}
        title="Card View"
      >
        <LayoutGrid className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Cards</span>
      </Button>
      <Button
        onClick={() => onChange("table")}
        variant={value === "table" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "flex items-center rounded-l-none",
          value === "table" && "bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
        )}
        title="Table View"
      >
        <List className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Table</span>
      </Button>
    </div>
  );
}
