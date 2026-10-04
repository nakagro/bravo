import { useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { PageTabs } from "../components/shared/PageTabs";
import { NightsTab } from "../features/training/components/NightsTab";
import { MembersTab } from "../features/training/components/MembersTab";
import { ReportTab } from "../features/training/components/ReportTab";
import { trainingTabs, type TrainingTab } from "../features/training/types";

export function TrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const access = useQuery(api.training.getAccess);
  const canManage = access?.canManage ?? false;

  // The Duty Officer only records apologies, so only sees the nights
  const visibleTabs = useMemo(
    () => trainingTabs.filter((tab) => canManage || !tab.manageOnly),
    [canManage]
  );

  // The URL is the single source of truth for the active tab
  const urlTab = searchParams.get("tab");
  const activeTab: TrainingTab = visibleTabs.some((t) => t.key === urlTab)
    ? (urlTab as TrainingTab)
    : "nights";

  const handleTabChange = useCallback(
    (tab: string) => setSearchParams(tab === "nights" ? {} : { tab }, { replace: true }),
    [setSearchParams]
  );

  return (
    <div className="space-y-4" data-component="TrainingPage">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Roll</h1>

      {visibleTabs.length > 1 && (
        <PageTabs
          tabs={visibleTabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          ariaLabel="Training tabs"
        />
      )}

      <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "nights" && <NightsTab canManage={canManage} />}
        {activeTab === "members" && canManage && <MembersTab />}
        {activeTab === "report" && canManage && <ReportTab />}
      </div>
    </div>
  );
}
