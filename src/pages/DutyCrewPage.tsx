import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ThisWeekTab } from "../features/dutyCrew/components/ThisWeekTab";
import { ScheduleTab } from "../features/dutyCrew/components/ScheduleTab";
import { AdminTab } from "../features/dutyCrew/components/AdminTab";
import type { TabType } from "../features/dutyCrew/types";

export function DutyCrewPage() {
  const [activeTab, setActiveTab] = useState<TabType>("thisWeek");
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const adminAccess = moduleAccess?.admin;

  // Refs for tab animation
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Ensure we don't render a tab the user cannot access
  useEffect(() => {
    if (activeTab === "admin" && adminAccess === false) {
      setActiveTab("thisWeek");
    }
  }, [activeTab, adminAccess]);

  // Update indicator position when active tab changes
  useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab];
    if (activeTabElement) {
      setIndicatorStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      });
    }
  }, [activeTab, adminAccess]);

  const tabs: { key: TabType; label: string; adminOnly?: boolean }[] = [
    { key: "thisWeek", label: "This Week" },
    { key: "schedule", label: "Schedule" },
    { key: "admin", label: "Admin", adminOnly: true },
  ];

  return (
    <div className="space-y-4" data-component="DutyCrewPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Duty Crew
        </h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          {tabs.map((tab) => {
            if (tab.adminOnly && !adminAccess) return null;
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[tab.key] = el;
                }}
                onClick={() => setActiveTab(tab.key)}
                className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "text-red-600 dark:text-red-400 font-bold"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        {/* Animated indicator */}
        <div
          className="absolute bottom-0 h-0.5 bg-red-500 dark:bg-red-400 transition-all duration-300 ease-out"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "thisWeek" && (
          <ThisWeekTab isAdmin={adminAccess === true} />
        )}

        {activeTab === "schedule" && <ScheduleTab />}

        {activeTab === "admin" && adminAccess && <AdminTab />}
      </div>
    </div>
  );
}
