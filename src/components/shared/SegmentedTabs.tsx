import { useRef } from "react";
import { cn } from "@/lib/utils";

interface Segment<K extends string> {
  key: K;
  label: string;
}

interface SegmentedTabsProps<K extends string> {
  segments: readonly Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Second-level navigation inside a page tab: a full-width track of equal
 * segments. Deliberately unlike PageTabs' underline so the two levels never
 * read as one row. Arrow keys move between segments.
 */
export function SegmentedTabs<K extends string>({
  segments,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedTabsProps<K>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % segments.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + segments.length) % segments.length;
    else return;
    event.preventDefault();
    const key = segments[next].key;
    onChange(key);
    refs.current[key]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex w-full gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800", className)}
    >
      {segments.map((segment, index) => {
        const active = segment.key === value;
        return (
          <button
            key={segment.key}
            ref={(el) => {
              refs.current[segment.key] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(segment.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "min-h-11 flex-1 touch-manipulation rounded-md px-2 text-sm font-medium transition-colors",
              active
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
