import { useState, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Filter, X, Search } from "lucide-react";
import { TaskCategory, categoryConfig } from "./TaskCard";

export type FilterType = "all" | "overdue" | "today";

interface TaskFiltersProps {
    activeFilter: FilterType;
    filterCounts: { today: number; overdue: number };
    showCompleted: boolean;
    onFilterChange: (filter: FilterType) => void;
    onShowCompletedChange: (show: boolean) => void;
    activeCategory: string;
    onCategoryChange: (category: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

export function TaskFilters({
    activeFilter,
    filterCounts,
    showCompleted,
    onFilterChange,
    onShowCompletedChange,
    activeCategory,
    onCategoryChange,
    searchQuery,
    onSearchChange,
}: TaskFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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

    const hasActiveFilter = activeFilter !== "all" || showCompleted || activeCategory !== "all";

    return (
        <div className="flex gap-2 items-center">
            {/* Search input */}
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search tasks..."
                    className="w-full h-10 pl-9 pr-3 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                {searchQuery && (
                    <button
                        onClick={() => onSearchChange("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>

            {/* Filter dropdown */}
            <div className="relative" ref={menuRef}>
                <Button
                    variant={hasActiveFilter ? "default" : "outline"}
                    size="icon"
                    onClick={() => setIsOpen(!isOpen)}
                    className="h-10 w-10 flex-shrink-0"
                >
                    <Filter className="h-4 w-4" />
                </Button>

                {isOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                        {/* Status filters */}
                        <div className="p-2">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1 font-semibold">Status</p>
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
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                            filter.id === "overdue"
                                                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                                        }`}>
                                            {filter.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Category filters */}
                        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1 font-semibold">Category</p>
                            <button
                                onClick={() => { onCategoryChange("all"); setIsOpen(false); }}
                                className={`w-full px-3 py-1.5 text-left text-sm rounded transition-colors ${
                                    activeCategory === "all"
                                        ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-medium"
                                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                }`}
                            >
                                All Categories
                            </button>
                            {(Object.entries(categoryConfig) as [TaskCategory, typeof categoryConfig.maintenance][]).map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => { onCategoryChange(key); setIsOpen(false); }}
                                    className={`w-full px-3 py-1.5 text-left text-sm rounded transition-colors flex items-center gap-2 ${
                                        activeCategory === key
                                            ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-medium"
                                            : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${config.bgColor}`} />
                                    {config.label}
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

                        {hasActiveFilter && (
                            <div className="px-2 pb-2">
                                <button
                                    onClick={() => {
                                        onFilterChange("all");
                                        onShowCompletedChange(false);
                                        onCategoryChange("all");
                                        setIsOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center justify-center gap-1"
                                >
                                    <X className="h-3 w-3" />
                                    Clear All Filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
