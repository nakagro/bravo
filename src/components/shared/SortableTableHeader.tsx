import { TableHead } from "@/components/ui/table";
import { ChevronUp, ChevronDown } from "lucide-react";

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
      className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none ${className || ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          direction === "asc" ? (
            <ChevronUp className="h-4 w-4 text-red-600 dark:text-red-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-red-600 dark:text-red-400" />
          )
        ) : (
          <div className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );
}
