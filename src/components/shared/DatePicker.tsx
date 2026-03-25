import { useState } from "react";
import { format, parse } from "date-fns";
import { enAU } from "date-fns/locale";
import { CalendarDaysIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** Date value as YYYY-MM-DD string */
  value: string;
  /** Called with YYYY-MM-DD string */
  onChange: (value: string) => void;
  /** Minimum selectable date as YYYY-MM-DD string */
  min?: string;
  /** Placeholder text when no date selected */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** Disable the picker */
  disabled?: boolean;
}

/** Converts a YYYY-MM-DD string to a Date in local time */
function parseLocalDate(dateStr: string): Date {
  return parse(dateStr, "yyyy-MM-dd", new Date());
}

/** Converts a Date to YYYY-MM-DD string */
function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Inline collapsible calendar date picker.
 * Tap the date field to expand/collapse the calendar below it.
 * Works reliably inside Sheets, Drawers, Dialogs — no portals needed.
 */
export function DatePicker({
  value,
  onChange,
  min,
  placeholder = "Select date",
  className,
  disabled,
}: DatePickerProps) {
  const [expanded, setExpanded] = useState(false);

  const selectedDate = value ? parseLocalDate(value) : undefined;
  const minDate = min ? parseLocalDate(min) : undefined;

  return (
    <div className={cn("w-full", className)}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-base border rounded-lg transition-colors",
          "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800",
          expanded && "border-red-500 dark:border-red-500 ring-1 ring-red-500/20",
          !value && "text-gray-400 dark:text-gray-500",
          value && "text-gray-900 dark:text-gray-100",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className="flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
          {selectedDate
            ? format(selectedDate, "EEE d MMM yyyy", { locale: enAU })
            : placeholder}
        </span>
        {expanded ? (
          <ChevronUpIcon className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Inline calendar */}
      {expanded && (
        <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) {
                onChange(toDateString(date));
              }
              setExpanded(false);
            }}
            disabled={minDate ? { before: minDate } : undefined}
            defaultMonth={selectedDate || minDate}
          />
        </div>
      )}
    </div>
  );
}
