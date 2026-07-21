import { TableHead } from "@/components/ui/table";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableTableHeaderProps<T extends string> {
  field: T;
  label: string;
  currentField: T;
  direction: "asc" | "desc";
  onSort: (field: T) => void;
  className?: string;
}

export function SortableTableHeader<T extends string>({
  field,
  label,
  currentField,
  direction,
  onSort,
  className,
}: SortableTableHeaderProps<T>) {
  const isActive = currentField === field;
  return (
    <TableHead
      className={cn("p-0", className)}
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="flex min-h-11 w-full select-none items-center gap-1 px-4 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => onSort(field)}
      >
        {label}
        {isActive ? (
          direction === "asc" ? (
            <ChevronUp aria-hidden="true" className="size-4 text-red-600 dark:text-red-400" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-4 text-red-600 dark:text-red-400" />
          )
        ) : (
          <span className="size-4" aria-hidden="true" />
        )}
      </button>
    </TableHead>
  );
}
