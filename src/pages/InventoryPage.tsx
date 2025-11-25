import { useState, useEffect, useRef } from 'react';
import { useConvexAuth, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { InventoryTemplateList } from "../features/inventory/components/InventoryTemplateList";
import { InventoryRecentChecks } from "../features/inventory/components/InventoryRecentChecks";
import { InventoryTemplateSelector } from "../features/inventory/components/InventoryTemplateSelector";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";

export function InventoryPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"checks" | "history" | "templates">("checks");
  const hasTemplatesAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "inventoryAdmin" });
  
  // Get in-progress runs count for header context
  const inProgressRuns = useQuery(api.inventoryCheckRuns.getInProgressRuns);
  const activeCount = inProgressRuns?.length ?? 0;
  
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl font-semibold mb-4">Please login to view this page</h2>
        <button 
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-component="InventoryPage">
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
          {activeCount > 0 && (
            <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              {activeCount} in progress
            </Badge>
          )}
        </div>
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
