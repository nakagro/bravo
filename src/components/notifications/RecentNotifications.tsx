import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BellIcon, ClockIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

export function RecentNotifications() {
  const notifications = useQuery(api.notificationHistory.getRecentNotifications);

  // Don't render anything if there are no notifications
  if (!notifications || notifications.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        <BellIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Recent Notifications
        </h2>
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification._id}
            className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 rounded-r-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {notification.title}
                </h3>
                <div className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <ClockIcon className="h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">
                    {formatDistanceToNow(notification.sentAt, { addSuffix: true })}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {notification.body}
              </p>
            </div>
            
            {notification.url && (
              <div className="mt-2">
                <a
                  href={notification.url}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
                >
                  View details →
                </a>
              </div>
            )}
          </div>
        ))}
      </div>



    </div>
  );
}
