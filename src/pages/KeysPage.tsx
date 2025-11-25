import { useState, useRef, useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { KeyInventory } from "../features/keys/components/KeyInventory";
import { KeyAuditTrail } from "../features/keys/components/KeyAuditTrail";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";

export function KeysPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('inventory'); // Default to inventory tab

  // Get key count for header summary
  const keys = useQuery(api.keys.list, {});
  const keyCount = keys?.length ?? 0;

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
    <div className="space-y-4" data-component="KeysPage">
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Key Management</h1>
          {keys !== undefined && (
            <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              {keyCount} {keyCount === 1 ? 'key' : 'keys'}
            </Badge>
          )}
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
