import React, { useState } from "react";
import { KeyInventory } from "../features/keys/components/KeyInventory";
import { KeyAuditTrail } from "../features/keys/components/KeyAuditTrail";

export function KeysPage() {
  const [activeTab, setActiveTab] = useState('inventory'); // Default to inventory tab

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Key Management</h1>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4 -mb-px">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'inventory' 
                ? 'border-red-500 text-red-600 dark:text-red-400 dark:border-red-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'audit' 
                ? 'border-red-500 text-red-600 dark:text-red-400 dark:border-red-400' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Audit
          </button>
        </nav>
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
