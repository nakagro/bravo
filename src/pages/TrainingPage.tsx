import { useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { PageTabs } from "../components/shared/PageTabs";
import { PreviousTab } from "../features/training/components/PreviousTab";
import { RollTab } from "../features/training/components/RollTab";
import { MembersTab } from "../features/training/components/MembersTab";
import { AttendanceTab } from "../features/training/components/AttendanceTab";
import { trainingTabs, type TrainingTab } from "../features/training/types";

export function TrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const access = useQuery(api.training.getAccess);
  const canManage = access?.canManage ?? false;

  // The Duty Officer only records apologies ahead, so only sees the Roll tab
  const visibleTabs = useMemo(
    () => trainingTabs.filter((tab) => canManage || !tab.manageOnly),
    [canManage]
  );

  // The URL is the single source of truth for the active tab
  const urlTab = searchParams.get("tab");
  const activeTab: TrainingTab = visibleTabs.some((t) => t.key === urlTab)
    ? (urlTab as TrainingTab)
    : "roll";

  const handleTabChange = useCallback(
    (tab: string) => setSearchParams(tab === "roll" ? {} : { tab }, { replace: true }),
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
        {activeTab === "roll" && <RollTab canManage={canManage} />}
        {activeTab === "previous" && canManage && <PreviousTab />}
        {activeTab === "attendance" && canManage && <AttendanceTab />}
        {activeTab === "members" && canManage && <MembersTab />}
      </div>
    </div>
  );
}
