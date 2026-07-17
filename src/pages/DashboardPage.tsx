import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { CalDAVCalendar } from "../components/calendar/CalDAVCalendar";
import { FireDangerRating } from "../components/dashboard/FireDangerRating";
import { NAV_ITEMS } from "../config/navigation";

// --- Startup timing helper ---
const _t = (label: string) => (window as any).__BRAVO_T?.(label);

export function DashboardPage() {
  // --- Startup timing: track query resolutions ---
  const logged = useRef({ user: false, modules: false });
  useEffect(() => {
    _t("DashboardPage mounted");
  }, []);

  // Fetch the current user's data
  const user = useQuery(api.auth.loggedInUser);
  if (user !== undefined && !logged.current.user) {
    logged.current.user = true;
    _t("loggedInUser query resolved");
  }

  // Fetch all module access in a single query instead of 9 individual ones
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  if (moduleAccess !== undefined && !logged.current.modules) {
    logged.current.modules = true;
    _t("moduleAccess query resolved");
  }

  const visibleModules = NAV_ITEMS.filter(
    (item) =>
      !item.hideOnDashboard &&
      (item.alwaysVisible ||
        moduleAccess?.[item.id as keyof typeof moduleAccess] === true),
  );

  // Get the user's display name (prefer firstName if available)
  const displayName = user
    ? user.firstName
      ? `${user.firstName}`
      : user.name || user.email || "User"
    : "User";

  return (
    <div className="space-y-4" data-component="DashboardPage">
      {/* Welcome Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Welcome, {displayName}
        </h1>
      </div>

      {/* Fire Danger Rating */}
      <FireDangerRating />

      {/* Calendar Events */}
      {moduleAccess?.calendar === true ? (
        <CalDAVCalendar maxEvents={5} />
      ) : null}

      {/* Modules Section */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {visibleModules.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.id} to={item.path} className="group">
              <Card className="h-full hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
                <CardContent className="p-3 flex flex-col items-center text-center space-y-1.5">
                  <div
                    className={`p-2 rounded-lg transition-colors ${item.color.bg} ${item.color.bgHover}`}
                  >
                    <Icon
                      className={`h-5 w-5 sm:h-6 sm:w-6 ${item.color.fg}`}
                    />
                  </div>
                  <h3 className="text-sm sm:text-base font-medium text-card-foreground leading-tight">
                    {item.label}
                  </h3>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default DashboardPage;
