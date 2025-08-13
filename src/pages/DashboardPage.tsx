import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import { ArchiveBoxIcon, KeyIcon, CalendarIcon } from "@heroicons/react/24/outline";

export function DashboardPage() {
  // Fetch the current user's data
  const user = useQuery(api.auth.loggedInUser);
  
  // Fetch module access status for the current user
  const hoseAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "hoses" });
  const keysAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "keys" });
  const availabilityAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "availability" });
  
  // Fetch any pending actions or notifications
  const pendingActions = useQuery(api.dashboard.getPendingActions) || [];
  
  // Get the user's display name (prefer firstName if available)
  const displayName = user ? 
    (user.firstName) ? 
      `${user.firstName}` : 
      user.name || user.email || "User" : 
    "User";

  return (
    <div className="space-y-8" data-component="DashboardPage">
      {/* Welcome Section */}
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {displayName}</h1>
      </div>
      
      {/* Pending Actions Section */}
      {pendingActions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
            Actions Needed
          </h2>
          <div className="space-y-4">
            {pendingActions.map((action) => (
              <div 
                key={action._id} 
                className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 rounded-r-md"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">{action.title}</h3>
                    <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                      <p>{action.description}</p>
                    </div>
                    {action.actionUrl && (
                      <div className="mt-3">
                        <Link
                          to={action.actionUrl}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/40 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors"
                        >
                          Take Action
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Modules Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Availability */}
          {availabilityAccess && (
            <Link 
              to="/availability"
              className="flex flex-col items-center p-6 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700 group"
            >
              <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full mb-4 group-hover:bg-green-200 dark:group-hover:bg-green-900/40 transition-colors">
                <CalendarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Availability</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Manage your availability status and view brigade availability.
              </p>
            </Link>
          )}

          {/* Hose Inventory */}
          {hoseAccess && (
            <Link 
              to="/hoses"
              className="flex flex-col items-center p-6 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700 group"
            >
              <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-full mb-4 group-hover:bg-red-200 dark:group-hover:bg-red-900/40 transition-colors">
                <ArchiveBoxIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Hose Inventory</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Manage and track hose inventory, testing, and maintenance.
              </p>
            </Link>
          )}
          
          {/* Key Management */}
          {keysAccess && (
            <Link 
              to="/keys"
              className="flex flex-col items-center p-6 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700 group"
            >
              <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/40 transition-colors">
                <KeyIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Key Management</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Track and manage keys for various locations and facilities.
              </p>
            </Link>
          )}
          

        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
