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
import { BASkillsLMSTab } from "./components/BASkillsLMSTab";

type BASkillsTab = "log" | "mine" | "history" | "currency" | "lms";

const KNOWN_TABS: BASkillsTab[] = ["log", "mine", "history", "currency", "lms"];

function BASkillsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const canSubmit = moduleAccess?.baSkills ?? false;
  const isAdmin = moduleAccess?.baSkillsAdmin ?? false;

  // Pending-LMS count for the tab badge (admins only)
  const adminRecords = useQuery(api.baRecords.listRecords, isAdmin ? {} : "skip");
  const lmsPendingCount = useMemo(
    () => (adminRecords ?? []).filter((r) => r.lmsEnteredAt === undefined).length,
    [adminRecords],
  );

  const accessByTab: Record<BASkillsTab, boolean> = useMemo(
    () => ({
      log: canSubmit,
      mine: canSubmit,
      history: isAdmin,
      currency: isAdmin,
      lms: isAdmin,
    }),
    [canSubmit, isAdmin],
  );

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
    if (activeTab === "log" && !canSubmit && isAdmin) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", "history");
          return next;
        },
        { replace: true },
      );
    }
  }, [moduleAccess, activeTab, canSubmit, isAdmin, setSearchParams]);

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

  const handleMemberFilterChange = (userId: Id<"users"> | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "history");
        if (userId) next.set("member", userId);
        else next.delete("member");
        return next;
      },
      { replace: true },
    );
  };

  const tabs = useMemo(() => {
    const list: Array<{ key: BASkillsTab; label: string; badgeCount?: number }> = [];
    if (canSubmit) list.push({ key: "log", label: "Log" });
    if (canSubmit) list.push({ key: "mine", label: "My Records" });
    if (isAdmin) list.push({ key: "history", label: "History" });
    if (isAdmin) list.push({ key: "currency", label: "Currency" });
    if (isAdmin) list.push({ key: "lms", label: "LMS", badgeCount: lmsPendingCount });
    return list;
  }, [canSubmit, isAdmin, lmsPendingCount]);

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
        {activeTab === "mine" && canSubmit && (
          <BASkillsMyRecordsTab canManageRecords={isAdmin} />
        )}
        {activeTab === "history" && isAdmin && (
          <BASkillsHistoryTab
            filterMemberId={memberFilter}
            onMemberFilterChange={handleMemberFilterChange}
            canManageRecords={isAdmin}
          />
        )}
        {activeTab === "currency" && isAdmin && (
          <BASkillsCurrencyTab onViewMemberHistory={handleMemberFilterChange} />
        )}
        {activeTab === "lms" && isAdmin && <BASkillsLMSTab />}
      </div>
    </div>
  );
}

export default BASkillsPage;
