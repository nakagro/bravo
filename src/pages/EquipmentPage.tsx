import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { TriangleAlert } from "lucide-react";
import {
  EquipmentTakeTab,
  EquipmentStockTab,
  EquipmentReplenishTab,
  EquipmentManageTab,
  EquipmentRecentActivity,
} from "@/features/equipment/components";

export function EquipmentPage() {
  const [activeTab, setActiveTab] = useState("take");
  
  // Refs for tab animation
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  
  const lowStockItems = useQuery(api.equipment.getLowStockItems);
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);

  const canManage = moduleAccess?.equipmentAdmin ?? false;
  const lowStockCount = lowStockItems?.length ?? 0;

  // Update indicator position when active tab changes
  useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab];
    if (activeTabElement) {
      setIndicatorStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      });
    }
  }, [activeTab, canManage]);

  return (
    <div className="space-y-4" data-component="EquipmentPage">
      {/* Header */}
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Equipment</h1>
        {lowStockCount > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <TriangleAlert className="h-3 w-3" />
            {lowStockCount} low
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          <button
            ref={(el) => { tabRefs.current['take'] = el; }}
            onClick={() => setActiveTab('take')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'take' 
                ? 'text-red-600 dark:text-red-400 font-bold' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            Take
          </button>
          <button
            ref={(el) => { tabRefs.current['stock'] = el; }}
            onClick={() => setActiveTab('stock')}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === 'stock' 
                ? 'text-red-600 dark:text-red-400 font-bold' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
            }`}
          >
            Stock
          </button>
          {canManage && (
            <>
              <button
                ref={(el) => { tabRefs.current['replenish'] = el; }}
                onClick={() => setActiveTab('replenish')}
                className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'replenish'
                    ? 'text-red-600 dark:text-red-400 font-bold'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
                }`}
              >
                Replenish
              </button>
              <button
                ref={(el) => { tabRefs.current['history'] = el; }}
                onClick={() => setActiveTab('history')}
                className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'history'
                    ? 'text-red-600 dark:text-red-400 font-bold'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
                }`}
              >
                History
              </button>
              <button
                ref={(el) => { tabRefs.current['manage'] = el; }}
                onClick={() => setActiveTab('manage')}
                className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'manage'
                    ? 'text-red-600 dark:text-red-400 font-bold'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium'
                }`}
              >
                Manage
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
        {activeTab === 'take' && <EquipmentTakeTab />}
        {activeTab === 'stock' && <EquipmentStockTab />}
        {activeTab === 'replenish' && canManage && <EquipmentReplenishTab />}
        {activeTab === 'history' && canManage && <EquipmentRecentActivity />}
        {activeTab === 'manage' && canManage && <EquipmentManageTab />}
      </div>
    </div>
  );
}
