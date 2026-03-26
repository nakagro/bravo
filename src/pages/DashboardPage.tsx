import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import { ArchiveBoxIcon, KeyIcon, CalendarIcon } from "@heroicons/react/24/outline";
import { FileText, Users, Wrench, Link2, TriangleAlert, Calendar } from "lucide-react";
import { CalDAVCalendar } from "../components/calendar/CalDAVCalendar";
import { Card, CardContent } from "../components/ui/card";
import { RecentNotifications } from "../components/notifications/RecentNotifications";
import { FireDangerRating } from "../components/dashboard/FireDangerRating";

// --- Startup timing helper ---
const _t = (label: string) => (window as any).__BRAVO_T?.(label);

export function DashboardPage() {
  // --- Startup timing: track query resolutions ---
  const logged = useRef({ user: false, modules: false, actions: false });
  useEffect(() => { _t("DashboardPage mounted"); }, []);

  // Fetch the current user's data
  const user = useQuery(api.auth.loggedInUser);
  if (user !== undefined && !logged.current.user) { logged.current.user = true; _t("loggedInUser query resolved"); }

  // Fetch all module access in a single query instead of 9 individual ones
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  if (moduleAccess !== undefined && !logged.current.modules) { logged.current.modules = true; _t("moduleAccess query resolved"); }
  const hoseAccess = moduleAccess?.hoses;
  const keysAccess = moduleAccess?.keys;
  const availabilityAccess = moduleAccess?.availability;
  const fireReportsAccess = moduleAccess?.fireReports;
  const dutyCrewAccess = moduleAccess?.dutyCrew;
  const inventoryAccess = moduleAccess?.inventory;
  const linksAccess = moduleAccess?.links;
  const vehicleFaultsAccess = moduleAccess?.vehicleFaults;
  const bookingsAccess = moduleAccess?.bookings;

  // Fetch any pending actions or notifications
  const rawPendingActions = useQuery(api.dashboard.getPendingActions);
  if (rawPendingActions !== undefined && !logged.current.actions) { logged.current.actions = true; _t("pendingActions query resolved"); }
  const pendingActions = rawPendingActions || [];

  // Get the user's display name (prefer firstName if available)
  const displayName = user ?
    (user.firstName) ?
      `${user.firstName}` :
      user.name || user.email || "User" :
    "User";

  return (
    <div className="space-y-4" data-component="DashboardPage">
      {/* Welcome Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Welcome, {displayName}</h1>
      </div>

      {/* Pending Actions Section */}
      {pendingActions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 transition-colors duration-200">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
            Actions requiring attention
          </h2>
          <div className="space-y-3">
            {pendingActions.map((action) => (
              <div
                key={action._id}
                className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 rounded-r-md"
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
                          {action.actionLabel ?? "Take Action"}
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

      {/* Fire Danger Rating */}
      <FireDangerRating />

      {/* Calendar Events Section */}
      {/* <CalDAVCalendar
        calendarUrl="https://cal.grayhux.io/wydv/f892ab6b-44db-4f7d-2a79-9d87036546a8/"
        maxEvents={5}
        username={import.meta.env.VITE_CALDAV_USERNAME}
        password={import.meta.env.VITE_CALDAV_PASSWORD}
      /> */}

      {/* Modules Section */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">

        {/* Availability */}
        {availabilityAccess && (
          <Link to="/availability" className="group">
            <Card className="h-full hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
              <CardContent className="p-3 flex flex-col items-center text-center space-y-1.5">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/40 transition-colors">
                  <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-sm sm:text-base font-medium text-card-foreground leading-tight">Availability</h3>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Hose Management */}
        {hoseAccess && (
          <Link to="/hoses" className="group">
            <Card className="h-full hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
              <CardContent className="p-3 flex flex-col items-center text-center space-y-1.5">
                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-900/40 transition-colors">
                  <ArchiveBoxIcon className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-sm sm:text-base font-medium text-card-foreground leading-tight">Hose Management</h3>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Key Management */}
        {keysAccess && (
          <Link to="/keys" className="group">
            <Card className="h-full hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
              <CardContent className="p-3 flex flex-col items-center text-center space-y-1.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/40 transition-colors">
                  <KeyIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm sm:text-base font-medium text-card-foreground leading-tight">Key Management</h3>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Fire Reports */}
        {fireReportsAccess && (
          <Link to="/fire-reports" className="group">
            <Card className="h-full hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
              <CardContent className="p-3 flex flex-col items-center text-center space-y-1.5">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg group-hover:bg-orange-200 dark:group-hover:bg-orange-900/40 transition-colors">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-sm sm:text-base font-medium text-card-foreground leading-tight">Fire Reports</h3>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Duty Crew */}
        {dutyCrewAccess && (
          <Link to="/dutycrew" className="group">
            <Card className="h-full hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
              <CardContent className="p-3 flex flex-col items-center text-center space-y-1.5">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/40 transition-colors">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-sm sm:text-base font-medium text-card-foreground leading-tight">Duty Crew</h3>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Appliance Checks */}
        {inventoryAccess && (
          <Link to="/inventory" className="group">
            <Card className="h-full hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
              <CardContent className="p-3 flex flex-col items-center text-center space-y-1.5">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg group-hover:bg-yellow-200 dark:group-hover:bg-yellow-900/40 transition-colors">
                  <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-sm sm:text-base font-medium text-card-foreground leading-tight">Inventory</h3>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Links */}
        {linksAccess && (
          <Link to="/links" className="group">
            <Card className="h-full hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
              <CardContent className="p-3 flex flex-col items-center text-center space-y-1.5">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/20 rounded-lg group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/40 transition-colors">
                  <Link2 className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-600 dark:text-cyan-400" />
                </div>
                <h3 className="text-sm sm:text-base font-medium text-card-foreground leading-tight">Links</h3>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Vehicle Faults */}
        {vehicleFaultsAccess && (
          <Link to="/vehicle-faults" className="group">
            <Card className="h-full hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
              <CardContent className="p-3 flex flex-col items-center text-center space-y-1.5">
                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-900/40 transition-colors">
                  <TriangleAlert className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-sm sm:text-base font-medium text-card-foreground leading-tight">Vehicle Faults</h3>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Bookings */}
        {bookingsAccess && (
          <Link to="/bookings" className="group">
            <Card className="h-full hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
              <CardContent className="p-3 flex flex-col items-center text-center space-y-1.5">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/40 transition-colors">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-sm sm:text-base font-medium text-card-foreground leading-tight">Bookings</h3>
              </CardContent>
            </Card>
          </Link>
        )}

      </div>
    </div>
  );
}

export default DashboardPage;
