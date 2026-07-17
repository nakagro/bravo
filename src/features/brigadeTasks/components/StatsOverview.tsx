import { Clock, TriangleAlert, Sparkles } from "lucide-react";

interface TaskCounts {
    myTasks: number;
    overdue: number;
    urgent: number;
}

interface StatsOverviewProps {
    counts: TaskCounts;
    activeFilter: "all" | "overdue" | "urgent" | "high" | "today";
    onFilterChange: (filter: "all" | "overdue" | "urgent" | "high" | "today") => void;
}

export function StatsOverview({ counts, activeFilter, onFilterChange }: StatsOverviewProps) {
    const StatCard = ({
        type,
        count,
        label,
        icon: Icon,
        colorClass,
        bgClass,
        activeBorderClass
    }: {
        type: "all" | "overdue" | "urgent",
        count: number,
        label: string,
        icon: any,
        colorClass: string,
        bgClass: string,
        activeBorderClass: string
    }) => (
        <button
            onClick={() => onFilterChange(activeFilter === type ? "all" : type)}
            className={`
        p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-full
        ${activeFilter === type
                    ? `${activeBorderClass} shadow-sm bg-accent/5`
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
                }
      `}
        >
            <div className="flex items-start justify-between w-full mb-2">
                <div className={`p-1.5 rounded-lg ${bgClass}`}>
                    <Icon className={`h-4 w-4 ${colorClass}`} />
                </div>
                {count > 0 && activeFilter !== type && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${bgClass} ${colorClass}`}>
                        {count}
                    </span>
                )}
            </div>
            <div>
                <p className={`text-xl font-bold ${count > 0 ? colorClass : "text-gray-900 dark:text-white"}`}>
                    {count}
                </p>
                <p className="text-xs text-muted-foreground">{label}</p>
            </div>
        </button>
    );

    return (
        <div className="grid grid-cols-3 gap-3">
            <StatCard
                type="all"
                count={counts.myTasks}
                label="Active"
                icon={Clock}
                colorClass="text-blue-600 dark:text-blue-400"
                bgClass="bg-blue-100 dark:bg-blue-900/30"
                activeBorderClass="border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            />

            <StatCard
                type="overdue"
                count={counts.overdue}
                label="Overdue"
                icon={TriangleAlert}
                colorClass="text-red-600 dark:text-red-400"
                bgClass="bg-red-100 dark:bg-red-900/30"
                activeBorderClass="border-red-500 bg-red-50 dark:bg-red-900/20"
            />

            <StatCard
                type="urgent"
                count={counts.urgent}
                label="Urgent"
                icon={Sparkles}
                colorClass="text-orange-600 dark:text-orange-400"
                bgClass="bg-orange-100 dark:bg-orange-900/30"
                activeBorderClass="border-orange-500 bg-orange-50 dark:bg-orange-900/20"
            />
        </div>
    );
}
