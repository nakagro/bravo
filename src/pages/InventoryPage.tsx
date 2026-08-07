import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { InventoryTemplateList } from "../features/inventory/components/InventoryTemplateList";
import { InventoryRecentChecks } from "../features/inventory/components/InventoryRecentChecks";
import { InventoryTemplateSelector } from "../features/inventory/components/InventoryTemplateSelector";
import { InventoryAdminTab } from "../features/inventory/components/InventoryAdminTab";
import { api } from "../../convex/_generated/api";
import { PageTabs } from "@/components/shared/PageTabs";
import { Badge } from "@/components/ui/badge";

type InventoryTab = "checks" | "history" | "templates" | "admin";

export function InventoryPage() {
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const adminAccess = moduleAccess?.inventoryAdmin;

  // Get in-progress runs count for header context
  const inProgressRuns = useQuery(api.inventoryCheckRuns.getInProgressRuns);
  const activeCount = inProgressRuns?.length ?? 0;

  const requestedTab = searchParams.get("tab");
  const isKnownTab =
    requestedTab === "history" ||
    requestedTab === "templates" ||
    requestedTab === "admin";
  const isGatedTab = requestedTab === "templates" || requestedTab === "admin";
  const activeTab: InventoryTab = !requestedTab || !isKnownTab
    ? "checks"
    : isGatedTab && adminAccess !== true
      ? "checks"
      : (requestedTab as InventoryTab);

  // Normalize invalid/unauthorized tab values in the URL
  useEffect(() => {
    if (!requestedTab) return;
    if (isKnownTab && !(isGatedTab && adminAccess === false)) return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("tab");
      return next;
    }, { replace: true });
  }, [adminAccess, isGatedTab, isKnownTab, requestedTab, setSearchParams]);

  const handleTabChange = (tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "checks") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    }, { replace: true });
  };

  const tabs: Array<{ key: InventoryTab; label: string; badgeCount?: number }> = [
    { key: "checks", label: "Checks", badgeCount: activeCount },
    { key: "history", label: "History" },
  ];
  if (adminAccess) {
    tabs.push({ key: "templates", label: "Templates" });
    tabs.push({ key: "admin", label: "Admin" });
  }

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

      <PageTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
        ariaLabel="Inventory tabs"
      />

      <div
        className="mt-4"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "checks" && <InventoryTemplateSelector />}

        {activeTab === "history" && <InventoryRecentChecks />}

        {activeTab === "templates" && adminAccess && <InventoryTemplateList />}

        {activeTab === "admin" && adminAccess && (
          <InventoryAdminTab isAuthenticated={isAuthenticated} />
        )}
      </div>
    </div>
  );
}
