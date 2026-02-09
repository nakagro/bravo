import { useState, useEffect, useRef } from "react";
import { DutyCrewSchedule } from "../components/dutyCrew/DutyCrewSchedule";
import { DutyCrewAdmin } from "../components/dutyCrew/DutyCrewAdmin";
import { StationChecksTab } from "../components/dutyCrew/StationChecksTab";
import { StationChecksAdmin } from "../components/dutyCrew/StationChecksAdmin";
import { StationChecksHistory } from "../components/dutyCrew/StationChecksHistory";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type TabType = "schedule" | "stationChecks" | "administration" | "stationChecksAdmin" | "checksHistory";

export function DutyCrewPage() {
  const [activeTab, setActiveTab] = useState<TabType>("schedule");
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const adminAccess = moduleAccess?.admin;

  // Refs for tab animation
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Ensure we don't render a tab the user cannot access
  useEffect(() => {
    if ((activeTab === "administration" || activeTab === "stationChecksAdmin" || activeTab === "checksHistory") && adminAccess === false) {
      setActiveTab("schedule");
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

  return (
    <div className="space-y-4" data-component="DutyCrewPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Duty Crew</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          <button
            ref={(el) => { tabRefs.current['schedule'] = el; }}
            onClick={() => setActiveTab("schedule")}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === "schedule"
                ? 'text-red-600 dark:text-red-400 font-bold'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
              }`}
          >
            Schedule
          </button>
          <button
            ref={(el) => { tabRefs.current['stationChecks'] = el; }}
            onClick={() => setActiveTab("stationChecks")}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === "stationChecks"
                ? 'text-red-600 dark:text-red-400 font-bold'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
              }`}
          >
            Station Checks
          </button>
          {adminAccess && (
            <>
              <button
                ref={(el) => { tabRefs.current['administration'] = el; }}
                onClick={() => setActiveTab("administration")}
                className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === "administration"
                    ? 'text-red-600 dark:text-red-400 font-bold'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
                  }`}
              >
                Administration
              </button>
              <button
                ref={(el) => { tabRefs.current['stationChecksAdmin'] = el; }}
                onClick={() => setActiveTab("stationChecksAdmin")}
                className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === "stationChecksAdmin"
                    ? 'text-red-600 dark:text-red-400 font-bold'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
                  }`}
              >
                Station Checks Admin
              </button>
              <button
                ref={(el) => { tabRefs.current['checksHistory'] = el; }}
                onClick={() => setActiveTab("checksHistory")}
                className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === "checksHistory"
                    ? 'text-red-600 dark:text-red-400 font-bold'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
                  }`}
              >
                Checks History
              </button>
            </>
          )}
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
        {activeTab === "schedule" && (
          <DutyCrewSchedule />
        )}

        {activeTab === "stationChecks" && (
          <StationChecksTab />
        )}

        {activeTab === "administration" && adminAccess && (
          <DutyCrewAdmin />
        )}

        {activeTab === "stationChecksAdmin" && adminAccess && (
          <StationChecksAdmin />
        )}

        {activeTab === "checksHistory" && adminAccess && (
          <StationChecksHistory />
        )}
      </div>
    </div>
  );
}
