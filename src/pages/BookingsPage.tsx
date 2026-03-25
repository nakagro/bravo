import { useState, useCallback } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { BookingsTab } from "../features/bookings/components/BookingsTab";
import { AdminTab } from "../features/bookings/components/AdminTab";
import { ScheduleTab } from "../features/bookings/components/ScheduleTab";
import { PageTabs } from "../components/shared/PageTabs";
import { BookingTab, bookingTabs } from "../features/bookings/types";

export function BookingsPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentUser = useQuery(api.auth.loggedInUser);
  const isAdmin = currentUser?.isAdmin || false;

  const dateFromUrl = searchParams.get("date");

  // Get initial tab from URL or default to bookings
  const getInitialTab = (): BookingTab => {
    const urlTab = searchParams.get("tab");
    if (urlTab && bookingTabs.some((t) => t.key === urlTab)) {
      return urlTab as BookingTab;
    }
    return "bookings";
  };

  const [activeTab, setActiveTab] = useState<BookingTab>(getInitialTab);

  // Sync URL with tab state
  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab as BookingTab);
      setSearchParams(tab === "bookings" ? {} : { tab }, { replace: true });
    },
    [setSearchParams]
  );

  // Filter tabs based on admin status
  const visibleTabs = isAdmin ? bookingTabs : bookingTabs.filter((t) => t.key !== "admin");

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
    <div className="space-y-4" data-component="BookingsPage">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings</h1>

      <PageTabs
        tabs={visibleTabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        ariaLabel="Bookings tabs"
      />

      {/* Tab Content */}
      <div className="mt-4">
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === "bookings" && <BookingsTab />}

          {activeTab === "schedule" && (
            <ScheduleTab isAdmin={isAdmin} initialDate={dateFromUrl || undefined} />
          )}

          {activeTab === "admin" && isAdmin && <AdminTab />}
        </div>
      </div>
    </div>
  );
}
