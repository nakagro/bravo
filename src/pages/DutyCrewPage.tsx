import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { PageTabs } from "@/components/shared/PageTabs";
import { ThisWeekTab } from "../features/dutyCrew/components/ThisWeekTab";
import { ScheduleTab } from "../features/dutyCrew/components/ScheduleTab";
import { HistoryTab } from "../features/dutyCrew/components/HistoryTab";
import { AdminTab } from "../features/dutyCrew/components/AdminTab";
import type { TabType } from "../features/dutyCrew/types";

export function DutyCrewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const adminAccess = moduleAccess?.admin;

  const requestedTab = searchParams.get("tab");
  const isKnownTab =
    requestedTab === "schedule" ||
    requestedTab === "history" ||
    requestedTab === "admin";
  const activeTab: TabType = !requestedTab || !isKnownTab
    ? "thisWeek"
    : requestedTab === "admin" && adminAccess !== true
      ? "thisWeek"
      : (requestedTab as TabType);

  // Normalize invalid/unauthorized tab values in the URL
  useEffect(() => {
    if (!requestedTab) return;
    if (isKnownTab && !(requestedTab === "admin" && adminAccess === false)) return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("tab");
      return next;
    }, { replace: true });
  }, [adminAccess, isKnownTab, requestedTab, setSearchParams]);

  const handleTabChange = (tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "thisWeek") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    }, { replace: true });
  };

  const tabs: Array<{ key: TabType; label: string }> = [
    { key: "thisWeek", label: "This Week" },
    { key: "schedule", label: "Schedule" },
    { key: "history", label: "History" },
  ];
  if (adminAccess) {
    tabs.push({ key: "admin", label: "Admin" });
  }

  return (
    <div className="space-y-4" data-component="DutyCrewPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Duty Crew
        </h1>
      </div>

      <PageTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        ariaLabel="Duty Crew tabs"
      />

      <div
        className="mt-4"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "thisWeek" && (
          <ThisWeekTab isAdmin={adminAccess === true} />
        )}

        {activeTab === "schedule" && (
          <ScheduleTab isAdmin={adminAccess === true} />
        )}

        {activeTab === "history" && <HistoryTab />}

        {activeTab === "admin" && adminAccess && <AdminTab />}
      </div>
    </div>
  );
}
