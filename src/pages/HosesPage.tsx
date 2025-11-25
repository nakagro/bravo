import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { HoseDashboard } from "../features/hoses/components/HoseDashboard";
import { HoseInventory } from "../features/hoses/components/HoseInventory";
import { HoseStatusSync } from "../features/hoses/components/HoseStatusSync";
import { HoseAuditTrail } from "../features/hoses/components/HoseAuditTrail";
import {
  Status,
  UpcomingTestFilter,
  OverdueFilter,
  HoseFilterType,
  HoseTab,
  hoseTabs,
} from "../features/hoses/types";

// Tab button component for DRY code and accessibility
interface TabButtonProps {
  tabKey: HoseTab;
  label: string;
  isActive: boolean;
  onClick: () => void;
  tabRef: (el: HTMLButtonElement | null) => void;
}

function TabButton({ tabKey, label, isActive, onClick, tabRef }: TabButtonProps) {
  return (
    <button
      ref={tabRef}
      role="tab"
      id={`tab-${tabKey}`}
      aria-selected={isActive}
      aria-controls={`tabpanel-${tabKey}`}
      onClick={onClick}
      className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
        isActive
          ? "text-red-600 dark:text-red-400 font-bold"
          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
      }`}
    >
      {label}
    </button>
  );
}

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

  // Refs for tab animation
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Update indicator position when active tab changes
  useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab];
    if (activeTabElement) {
      setIndicatorStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      });
    }
  }, [activeTab]);

  // Sync URL with tab state
  const handleTabChange = useCallback(
    (tab: HoseTab) => {
      setActiveTab(tab);
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

      {/* Tabs with accessibility */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav
          role="tablist"
          aria-label="Hose management tabs"
          className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative"
        >
          {hoseTabs.map((tab) => (
            <TabButton
              key={tab.key}
              tabKey={tab.key}
              label={tab.label}
              isActive={activeTab === tab.key}
              onClick={() => handleTabChange(tab.key)}
              tabRef={(el) => {
                tabRefs.current[tab.key] = el;
              }}
            />
          ))}
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

      {/* Tab Content with accessibility */}
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
        </div>
      </div>
    </div>
  );
}
