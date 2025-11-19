import React, { useState, useEffect, useRef } from 'react';
import { InventoryTemplateList } from "../features/inventory/components/InventoryTemplateList";
import { InventoryRecentChecks } from "../features/inventory/components/RecentChecks";
import { InventoryTemplateSelector } from "../features/inventory/components/TemplateSelector";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState<"checks" | "history" | "templates">("checks");
  const hasTemplatesAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "inventoryAdmin" });
  
  // Refs for tab animation
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Ensure we don't render a tab the user cannot access
  useEffect(() => {
    if (activeTab === "templates" && hasTemplatesAccess === false) {
      setActiveTab("checks");
    }
  }, [activeTab, hasTemplatesAccess]);
  
  // Update indicator position when active tab changes
  useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab];
    if (activeTabElement) {
      setIndicatorStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      });
    }
  }, [activeTab, hasTemplatesAccess]);

  return (
    <div className="space-y-4" data-component="InventoryPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          <button
            ref={(el) => { tabRefs.current['checks'] = el; }}
            onClick={() => setActiveTab("checks")}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === "checks"
                ? 'text-red-600 dark:text-red-400 font-bold'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            Checks
          </button>
          <button
            ref={(el) => { tabRefs.current['history'] = el; }}
            onClick={() => setActiveTab("history")}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === "history"
                ? 'text-red-600 dark:text-red-400 font-bold'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            History
          </button>
          {hasTemplatesAccess && (
            <button
              ref={(el) => { tabRefs.current['templates'] = el; }}
              onClick={() => setActiveTab("templates")}
              className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
                activeTab === "templates"
                  ? 'text-red-600 dark:text-red-400 font-bold'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
              }`}
            >
              Templates
            </button>
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
        {activeTab === "checks" && (
          <InventoryTemplateSelector />
        )}

        {activeTab === "history" && (
          <InventoryRecentChecks />
        )}

        {activeTab === "templates" && hasTemplatesAccess && (
          <InventoryTemplateList />
        )}
      </div>
    </div>
  );
}
