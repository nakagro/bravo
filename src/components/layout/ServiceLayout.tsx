import { ReactNode } from "react";
import { useServiceAccount } from "@/features/serviceAccounts/ServiceAccountContext";
import { useLocation, Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Toaster } from "../ui/sonner";
import { isDevEnvironment } from "@/utils/environment";
import { ConnectionBanner } from "@/components/common/ConnectionBanner";

interface ServiceLayoutProps {
  children: ReactNode;
}

/** Maps moduleId → { path, label } for the service nav bar. */
const MODULE_NAV: Record<string, { path: string; label: string }> = {
  dashboard: { path: "/", label: "Dashboard" },
  kiosk: { path: "/kiosk", label: "Kiosk" },
  hoses: { path: "/hoses", label: "Hoses" },
  keys: { path: "/keys", label: "Keys" },
  dutyCrew: { path: "/dutycrew", label: "Duty Crew" },
  inventory: { path: "/inventory", label: "Inventory" },
  vehicleFaults: { path: "/vehicle-faults", label: "Vehicle Faults" },
  bookings: { path: "/bookings", label: "Bookings" },
  availability: { path: "/availability", label: "Availability" },
  fireReports: { path: "/fire-reports", label: "Fire Reports" },
  feedback: { path: "/feedback", label: "Feedback" },
  links: { path: "/links", label: "Links" },
  equipment: { path: "/equipment", label: "Equipment" },
  baSkills: { path: "/ba-skills", label: "BA Skills" },
  brigadeTasks: { path: "/brigade-tasks", label: "Tasks" },
};

export function ServiceLayout({ children }: ServiceLayoutProps) {
  const { accountName, allowedModules, logout } = useServiceAccount();
  const location = useLocation();

  // Build nav items from allowed modules
  const navItems = allowedModules
    .map((id) => MODULE_NAV[id])
    .filter(Boolean);

  const showNav = navItems.length > 1;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Top bar */}
        <div className="px-4 py-2 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-red-700 dark:text-red-600">
              BRAVO
            </h2>
            {accountName && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {accountName}
              </span>
            )}
            {isDevEnvironment() && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-500 text-amber-950">
                DEV
              </span>
            )}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

        {/* Navigation tabs (only if multiple modules) */}
        {showNav && (
          <nav className="px-4 flex gap-1 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? "border-red-600 text-red-700 dark:text-red-400 dark:border-red-500"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
        <ConnectionBanner />
      </header>
      <main className="flex-1 p-4">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
