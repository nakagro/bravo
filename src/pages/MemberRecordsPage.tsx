import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { PageTabs } from "@/components/shared/PageTabs";
import { api } from "../../convex/_generated/api";
import { MemberRecordsList } from "../features/memberRecords/components/MemberRecordsList";
import { KitRegisterEditor } from "../features/memberRecords/components/KitRegisterEditor";

type MemberRecordsTab = "members" | "kit";

const KNOWN_TABS: MemberRecordsTab[] = ["members", "kit"];

/**
 * Two tabs: Members, and Kit for those who can define it. Member profiles,
 * kit sets and items are all their own routes; nothing here opens an overlay.
 */
function MemberRecordsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const canManageKit = moduleAccess?.memberRecordsAdmin ?? false;

  const requestedTab = searchParams.get("tab") as MemberRecordsTab | null;
  const isKnownTab = requestedTab !== null && KNOWN_TABS.includes(requestedTab);
  const activeTab: MemberRecordsTab =
    isKnownTab && (requestedTab !== "kit" || canManageKit) ? requestedTab : "members";

  // Drop a tab the user cannot reach (e.g. a shared link, or access removed)
  useEffect(() => {
    if (!requestedTab) return;
    if (isKnownTab && (requestedTab !== "kit" || canManageKit)) return;
    if (moduleAccess === undefined) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("tab");
        return next;
      },
      { replace: true },
    );
  }, [requestedTab, isKnownTab, canManageKit, moduleAccess, setSearchParams]);

  const handleTabChange = (tab: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "members") next.delete("tab");
        else next.set("tab", tab);
        return next;
      },
      { replace: true },
    );
  };

  const tabs = useMemo(() => {
    const list: { key: MemberRecordsTab; label: string }[] = [{ key: "members", label: "Members" }];
    if (canManageKit) list.push({ key: "kit", label: "Kit" });
    return list;
  }, [canManageKit]);

  return (
    <div className="space-y-4" data-component="MemberRecordsPage">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Member Records</h1>
      </div>

      {tabs.length > 1 && (
        <PageTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          ariaLabel="Member Records tabs"
        />
      )}

      <div
        className="mt-4"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "members" && <MemberRecordsList />}
        {activeTab === "kit" && canManageKit && <KitRegisterEditor />}
      </div>
    </div>
  );
}

export default MemberRecordsPage;
