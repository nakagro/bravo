import React, { useState, useRef, useEffect } from "react";
import { HoseDashboard } from "../features/hoses/components/HoseDashboard";
import { HoseInventory } from "../features/hoses/components/HoseInventory";
import { HoseStatusSync } from "../features/hoses/components/HoseStatusSync";
import { HoseAuditTrail } from "../features/hoses/components/HoseAuditTrail";
import { ChartBarIcon, TableCellsIcon, ArrowPathIcon, ClockIcon } from "@heroicons/react/24/outline";

type Status = "With district for repair" | "Condemned" | "Due for testing" | "In date";
type UpcomingTestFilter = "1month" | "3months" | "6months";
type FilterType = Status | UpcomingTestFilter | null;

export function HosesPage() {
  const [activeTab, setActiveTab] = useState('dashboard'); // Default to dashboard tab
  const [inventoryFilter, setInventoryFilter] = useState<FilterType>(null);

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

  // Function to handle status card clicks from dashboard
  const handleStatusCardClick = (status: Status) => {
    setInventoryFilter(status);
    setActiveTab('inventory');
  };

  // Function to handle upcoming test date card clicks
  const handleUpcomingTestClick = (timeframe: UpcomingTestFilter) => {
    setInventoryFilter(timeframe);
    setActiveTab('inventory');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hose Management</h1>
        </div>
      </div>

      {/* Tabs */}

      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          <button
            ref={(el) => { tabRefs.current['dashboard'] = el; }}
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === 'dashboard'
              ? 'text-red-600 dark:text-red-400 font-bold'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
              }`}
          >
            Dashboard
          </button>
          <button
            ref={(el) => { tabRefs.current['inventory'] = el; }}
            onClick={() => setActiveTab('inventory')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === 'inventory'
              ? 'text-red-600 dark:text-red-400 font-bold'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
              }`}
          >
            Inventory
          </button>

          <button
            ref={(el) => { tabRefs.current['audit'] = el; }}
            onClick={() => setActiveTab('audit')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === 'audit'
              ? 'text-red-600 dark:text-red-400 font-bold'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
              }`}
          >
            Audit
          </button>
          <button
            ref={(el) => { tabRefs.current['status'] = el; }}
            onClick={() => setActiveTab('status')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${activeTab === 'status'
              ? 'text-red-600 dark:text-red-400 font-bold'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
              }`}
          >
            Sync
          </button>
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
        {activeTab === 'dashboard' && (
          <HoseDashboard
            onStatusCardClick={handleStatusCardClick}
            onUpcomingTestClick={handleUpcomingTestClick}
          />
        )}

        {activeTab === 'inventory' && (
          <HoseInventory initialStatusFilter={inventoryFilter} onFilterApplied={() => setInventoryFilter(null)} />
        )}

        {activeTab === 'status' && (
          <HoseStatusSync />
        )}

        {activeTab === 'audit' && (
          <HoseAuditTrail />
        )}
      </div>
    </div>
  );
}
