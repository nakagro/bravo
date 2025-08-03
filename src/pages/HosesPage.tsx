import React, { useState } from "react";
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
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4 -mb-px">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'dashboard' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {/* <ChartBarIcon className="h-4 w-4" /> */}
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'inventory' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {/* <TableCellsIcon className="h-4 w-4" /> */}
            Inventory
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'audit' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {/* <ClockIcon className="h-4 w-4" /> */}
            Audit
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'status' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {/* <ArrowPathIcon className="h-4 w-4" /> */}
            Sync
          </button>
        </nav>
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
