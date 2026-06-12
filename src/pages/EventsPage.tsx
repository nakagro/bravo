import { useCallback, useMemo } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { UpcomingTab } from "../features/events/components/UpcomingTab";
import { PastTab } from "../features/events/components/PastTab";
import { AdminTab } from "../features/events/components/AdminTab";
import { PageTabs } from "../components/shared/PageTabs";
import { EventTab, eventTabs } from "../features/events/types";

export function EventsPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  // The admin tab is gated by the eventsAdmin module (Lieutenant+ by default),
  // not by isAdmin
  const canManageEvents = moduleAccess?.eventsAdmin === true;

  // The URL is the single source of truth for the active tab
  const urlTab = searchParams.get("tab");
  const activeTab: EventTab =
    urlTab && eventTabs.some((t) => t.key === urlTab) ? (urlTab as EventTab) : "upcoming";

  // Legacy ?event=<id> deep links (older notifications) → detail page
  const eventIdFromUrl = searchParams.get("event");

  const handleTabChange = useCallback(
    (tab: string) => {
      setSearchParams(tab === "upcoming" ? {} : { tab }, { replace: true });
    },
    [setSearchParams]
  );

  const visibleTabs = useMemo(
    () => eventTabs.filter((t) => canManageEvents || t.key !== "admin"),
    [canManageEvents]
  );

  if (eventIdFromUrl) {
    return <Navigate to={`/events/${eventIdFromUrl}`} replace />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl font-semibold mb-4">Please login to view this page</h2>
        <button
          onClick={() => navigate("/login")}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-component="EventsPage">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events</h1>

      <PageTabs
        tabs={visibleTabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        ariaLabel="Events tabs"
      />

      {/* Tab Content */}
      <div className="mt-4">
        <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {activeTab === "upcoming" && <UpcomingTab />}

          {activeTab === "past" && <PastTab />}

          {activeTab === "admin" && canManageEvents && <AdminTab />}
        </div>
      </div>
    </div>
  );
}
