import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { HoseDashboard } from "../features/hoses/components/HoseDashboard";
import { HoseInventory } from "../features/hoses/components/HoseInventory";
import { HoseStatusSync } from "../features/hoses/components/HoseStatusSync";
import { HoseAuditTrail } from "../features/hoses/components/HoseAuditTrail";
import { HoseTapeColors } from "../features/hoses/components/HoseTapeColors";
import { PageTabs } from "../components/shared/PageTabs";
import {
  Status,
  UpcomingTestFilter,
  OverdueFilter,
  HoseFilterType,
  HoseTab,
  hoseTabs,
} from "../features/hoses/types";

export function HosesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get initial tab from URL or default to dashboard
  const getInitialTab = (): HoseTab => {
    const urlTab = searchParams.get("tab");
    if (urlTab && hoseTabs.some((t) => t.key === urlTab)) {
      return urlTab as HoseTab;
    }
    return "dashboard";
  };

  const [activeTab, setActiveTab] = useState<HoseTab>(getInitialTab);
  const [inventoryFilter, setInventoryFilter] = useState<HoseFilterType>(null);

  // Sync URL with tab state
  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab as HoseTab);
      setSearchParams({ tab }, { replace: true });
    },
    [setSearchParams]
  );

  // Handle status card clicks from dashboard
  const handleStatusCardClick = useCallback(
    (status: Status) => {
      setInventoryFilter(status);
      handleTabChange("inventory");
    },
    [handleTabChange]
  );

  // Handle upcoming test date card clicks
  const handleUpcomingTestClick = useCallback(
    (timeframe: UpcomingTestFilter) => {
      setInventoryFilter(timeframe);
      handleTabChange("inventory");
    },
    [handleTabChange]
  );

  // Handle overdue card clicks
  const handleOverdueClick = useCallback(
    (timeframe: OverdueFilter) => {
      setInventoryFilter(timeframe);
      handleTabChange("inventory");
    },
    [handleTabChange]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Hose Management
      </h1>

      <PageTabs
        tabs={hoseTabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        ariaLabel="Hose management tabs"
      />

      {/* Tab Content */}
      <div className="mt-4">
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === "dashboard" && (
            <HoseDashboard
              onStatusCardClick={handleStatusCardClick}
              onUpcomingTestClick={handleUpcomingTestClick}
              onOverdueClick={handleOverdueClick}
            />
          )}

          {activeTab === "inventory" && (
            <HoseInventory
              initialStatusFilter={inventoryFilter}
              onFilterApplied={() => setInventoryFilter(null)}
            />
          )}

          {activeTab === "sync" && <HoseStatusSync />}

          {activeTab === "audit" && <HoseAuditTrail />}

          {activeTab === "tapeColors" && <HoseTapeColors />}
        </div>
      </div>
    </div>
  );
}
