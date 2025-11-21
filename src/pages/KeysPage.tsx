import React, { useState, useRef, useEffect } from "react";
import { KeyInventory } from "../features/keys/components/KeyInventory";
import { KeyAuditTrail } from "../features/keys/components/KeyAuditTrail";

export function KeysPage() {
  const [activeTab, setActiveTab] = useState('inventory'); // Default to inventory tab

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Key Management</h1>
        </div>
      </div>

      {/* Tabs */}

      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
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
        {activeTab === 'inventory' && (
          <KeyInventory />
        )}

        {activeTab === 'audit' && (
          <KeyAuditTrail />
        )}
      </div>
    </div>
  );
}
