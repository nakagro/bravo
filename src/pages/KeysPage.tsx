import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyInventory } from "../features/keys/components/KeyInventory";
import { KeyAuditTrail } from "../features/keys/components/KeyAuditTrail";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { PageTabs } from "@/components/shared/PageTabs";

type KeysTab = "inventory" | "audit";

const KEY_TABS: Array<{ key: KeysTab; label: string }> = [
  { key: "inventory", label: "Inventory" },
  { key: "audit", label: "Audit" },
];

export function KeysPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const isValidTab = requestedTab === "inventory" || requestedTab === "audit";
  const activeTab: KeysTab = isValidTab ? (requestedTab as KeysTab) : "inventory";

  // Get key count for header summary
  const keys = useQuery(api.keys.list, {});
  const keyCount = keys?.length ?? 0;

  useEffect(() => {
    if (!requestedTab || isValidTab) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("tab");
      return next;
    }, { replace: true });
  }, [isValidTab, requestedTab, setSearchParams]);

  const handleTabChange = (tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "inventory") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    }, { replace: true });
  };

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

      <PageTabs
        tabs={KEY_TABS}
        activeTab={activeTab}
        onChange={handleTabChange}
        ariaLabel="Key management tabs"
      />

      {/* Tab Content */}
      <div
        className="mt-4"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "inventory" && <KeyInventory />}
        {activeTab === "audit" && <KeyAuditTrail />}
      </div>
    </div>
  );
}
