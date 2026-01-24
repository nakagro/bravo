import { useState, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

export type FilterType = "all" | "overdue" | "today";

interface TaskFiltersProps {
    activeFilter: FilterType;
    filterCounts: { today: number; overdue: number };
    showCompleted: boolean;
    onFilterChange: (filter: FilterType) => void;
    onShowCompletedChange: (show: boolean) => void;
}

export function TaskFilters({
    activeFilter,
    filterCounts,
    showCompleted,
    onFilterChange,
    onShowCompletedChange
}: TaskFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const filters: { id: FilterType; label: string; count?: number }[] = [
        { id: "all", label: "All Tasks" },
        { id: "today", label: "Due Today", count: filterCounts.today },
        { id: "overdue", label: "Overdue", count: filterCounts.overdue },
    ];

    const hasActiveFilter = activeFilter !== "all" || showCompleted;

    return (
        <div className="relative" ref={menuRef}>
            {/* Filter button */}
            <Button
                variant={hasActiveFilter ? "default" : "outline"}
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                className="h-12 w-12 flex-shrink-0"
            >
                <Filter className="h-5 w-5" />
            </Button>

            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="p-2">
                        {filters.map((filter) => (
                            <button
                                key={filter.id}
                                onClick={() => {
                                    onFilterChange(filter.id);
                                    setIsOpen(false);
                                }}
                                className={`
                                    w-full px-3 py-2 text-left text-sm rounded transition-colors flex items-center justify-between
                                    ${activeFilter === filter.id
                                        ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-medium"
                                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                    }
                                `}
                            >
                                <span>{filter.label}</span>
                                {filter.count !== undefined && filter.count > 0 && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter.id === "overdue" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                                            "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                                        }`}>
                                        {filter.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Show completed toggle */}
                    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="show-completed"
                                checked={showCompleted}
                                onCheckedChange={(checked) => onShowCompletedChange(checked as boolean)}
                            />
                            <Label htmlFor="show-completed" className="text-sm cursor-pointer">
                                Show completed
                            </Label>
                        </div>
                    </div>

                    {/* Clear filters */}
                    {hasActiveFilter && (
                        <div className="px-2 pb-2">
                            <button
                                onClick={() => {
                                    onFilterChange("all");
                                    onShowCompletedChange(false);
                                    setIsOpen(false);
                                }}
                                className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center justify-center gap-1"
                            >
                                <X className="h-3 w-3" />
                                Clear Filters
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
