import { Link } from "react-router-dom";
import { Bell, CalendarDays, Calendar, CalendarCheck, ClipboardList } from "lucide-react";
import type { ActionItem } from "../types";
import { priorityColors } from "../types";

const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  availability: CalendarDays,
  bookings: Calendar,
  events: CalendarCheck,
  actions: ClipboardList,
  settings: Bell,
};

interface ActionCardProps {
  action: ActionItem;
}

export function ActionCard({ action }: ActionCardProps) {
  const Icon = moduleIcons[action.moduleId] ?? Bell;
  const colorClass = priorityColors[action.priority];

  return (
    <div className={`p-3 border-l-4 rounded-r-md ${colorClass}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">
              {action.title}
            </h3>
            {action.count !== undefined && action.count > 1 && (
              <span className="text-xs font-semibold bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full px-1.5 py-0.5 border border-gray-200 dark:border-gray-600">
                {action.count}
              </span>
            )}
          </div>
          {action.description && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{action.description}</p>
          )}
          {action.url && (
            <Link
              to={action.url}
              className="mt-2 inline-flex items-center px-3 py-1 text-xs font-medium rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              {action.actionLabel ?? "View"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
