import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { PageTabs } from "@/components/shared/PageTabs";
import { BASkillsLogTab } from "./components/BASkillsLogTab";
import { BASkillsMyRecordsTab } from "./components/BASkillsMyRecordsTab";
import { BASkillsHistoryTab } from "./components/BASkillsHistoryTab";
import { BASkillsCurrencyTab } from "./components/BASkillsCurrencyTab";
import { BASkillsExportTab } from "./components/BASkillsExportTab";

type BASkillsTab = "log" | "mine" | "history" | "currency" | "export";

const KNOWN_TABS: BASkillsTab[] = ["log", "mine", "history", "currency", "export"];

function BASkillsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const canSubmit = moduleAccess?.baSkills ?? false;
  const canViewHistory = moduleAccess?.baSkillsAdmin ?? false;
  const canViewCurrency = moduleAccess?.baSkillsAdmin ?? false;
  const canExport = moduleAccess?.baSkillsAdmin ?? false;

  const accessByTab: Record<BASkillsTab, boolean> = {
    log: canSubmit,
    mine: canSubmit,
    history: canViewHistory,
    currency: canViewCurrency,
    export: canExport,
  };

  const requestedTab = searchParams.get("tab") as BASkillsTab | null;
  const memberFilter = searchParams.get("member") as Id<"users"> | null;
  const isKnownTab = requestedTab !== null && KNOWN_TABS.includes(requestedTab);
  const activeTab: BASkillsTab =
    !requestedTab || !isKnownTab
      ? "log"
      : !accessByTab[requestedTab]
        ? "log"
        : requestedTab;

  // Normalise unknown / unauthorised tab values
  useEffect(() => {
    if (!requestedTab) return;
    if (isKnownTab && accessByTab[requestedTab]) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("tab");
        next.delete("member");
        return next;
      },
      { replace: true },
    );
  }, [requestedTab, isKnownTab, accessByTab, setSearchParams]);

  // Fall back if log tab itself isn't accessible
  useEffect(() => {
    if (moduleAccess === undefined) return;
    if (activeTab === "log" && !canSubmit) {
      const fallback = canViewHistory
        ? "history"
        : canViewCurrency
          ? "currency"
          : canExport
            ? "export"
            : null;
      if (fallback) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", fallback);
            return next;
          },
          { replace: true },
        );
      }
    }
  }, [moduleAccess, activeTab, canSubmit, canViewHistory, canViewCurrency, canExport, setSearchParams]);

  const handleTabChange = (tab: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "log") {
          next.delete("tab");
        } else {
          next.set("tab", tab);
        }
        // Member filter is only valid on history tab
        if (tab !== "history") next.delete("member");
        return next;
      },
      { replace: true },
    );
  };

  const handleViewMemberHistory = (userId: Id<"users">) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "history");
        next.set("member", userId);
        return next;
      },
      { replace: true },
    );
  };

  const handleClearMemberFilter = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("member");
        return next;
      },
      { replace: true },
    );
  };

  const tabs = useMemo(() => {
    const list: Array<{ key: BASkillsTab; label: string }> = [];
    if (canSubmit) list.push({ key: "log", label: "Log" });
    if (canSubmit) list.push({ key: "mine", label: "My Records" });
    if (canViewHistory) list.push({ key: "history", label: "History" });
    if (canViewCurrency) list.push({ key: "currency", label: "Currency" });
    if (canExport) list.push({ key: "export", label: "Export" });
    return list;
  }, [canSubmit, canViewHistory, canViewCurrency, canExport]);

  const showTabs = tabs.length > 1;

  return (
    <div className="space-y-4" data-component="BASkillsPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BA Skills</h1>
      </div>

      {showTabs && (
        <PageTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          ariaLabel="BA Skills tabs"
        />
      )}

      <div
        className="mt-4"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "log" && canSubmit && <BASkillsLogTab />}
        {activeTab === "mine" && canSubmit && <BASkillsMyRecordsTab />}
        {activeTab === "history" && canViewHistory && (
          <BASkillsHistoryTab
            filterMemberId={memberFilter}
            onClearMemberFilter={handleClearMemberFilter}
          />
        )}
        {activeTab === "currency" && canViewCurrency && (
          <BASkillsCurrencyTab onViewMemberHistory={handleViewMemberHistory} />
        )}
        {activeTab === "export" && canExport && <BASkillsExportTab />}
      </div>
    </div>
  );
}

export default BASkillsPage;
