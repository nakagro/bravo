import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface InventorySearchProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

export function InventorySearch({
  placeholder = "Search...",
  value,
  onChange,
  debounceMs = 400,
}: InventorySearchProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce the onChange callback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange, value]);

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
  }, [onChange]);

  return (
    <div className="relative min-w-0 flex-1">
      <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="inventory-search"
        aria-label="Search inventory"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="min-h-11 bg-background pl-9 pr-10 focus-visible:ring-red-500 [&::-webkit-search-cancel-button]:hidden"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          type="button"
          aria-label="Clear search"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
