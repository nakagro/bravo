import React from "react";
import { ApplianceTemplateList } from "../features/applianceChecks/components/ApplianceTemplateList";
import RecentChecks from "../features/applianceChecks/components/RecentChecks";
import TemplateSelector from "../features/applianceChecks/components/TemplateSelector";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function AppliancesPage() {
  const [activeTab, setActiveTab] = React.useState<"checks" | "history" | "templates">("checks");
  const hasTemplatesAccess = useQuery(api.modules.checkModuleAccess, { moduleId: "applianceChecksAdmin" });

  // Ensure we don't render a tab the user cannot access
  React.useEffect(() => {
    if (activeTab === "templates" && hasTemplatesAccess === false) {
      setActiveTab("checks");
    }
  }, [activeTab, hasTemplatesAccess]);

  return (
    <div className="space-y-4" data-component="AppliancesPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Appliance Checks</h1>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4 -mb-px">
          <button
            onClick={() => setActiveTab("checks")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "checks"
                ? "border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600"
            }`}
          >
            Checks
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "history"
                ? "border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600"
            }`}
          >
            History
          </button>
          {hasTemplatesAccess && (
            <button
              onClick={() => setActiveTab("templates")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "templates"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600"
              }`}
            >
              Templates
            </button>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "checks" && (
          <TemplateSelector />
        )}

        {activeTab === "history" && (
          <RecentChecks />
        )}

        {activeTab === "templates" && hasTemplatesAccess && (
          <ApplianceTemplateList />
        )}
      </div>
    </div>
  );
}
