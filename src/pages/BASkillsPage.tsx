import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { BASkillsForm, BASkillsRecordList, BASkillsAudit } from "@/features/baSkills/components";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

export function BASkillsPage() {
  const [activeTab, setActiveTab] = useState("submit");
  const isMobile = useIsMobile();

  // Get module permissions
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const canSubmit = moduleAccess?.baSkills ?? false;
  const canViewHistory = moduleAccess?.baSkillsAdmin ?? false;
  const canViewAudit = moduleAccess?.baSkillsAdmin ?? false;

  const visibleTabCount = [canSubmit, canViewHistory, canViewAudit].filter(Boolean).length;
  const showTabs = visibleTabCount > 1;

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

  // Switch to first available tab if current tab is not accessible
  useEffect(() => {
    if (!canSubmit && !canViewHistory && !canViewAudit) return;

    if (activeTab === "submit" && !canSubmit) {
      setActiveTab(canViewHistory ? "history" : "audit");
    } else if (activeTab === "history" && !canViewHistory) {
      setActiveTab(canSubmit ? "submit" : "audit");
    } else if (activeTab === "audit" && !canViewAudit) {
      setActiveTab(canSubmit ? "submit" : "history");
    }
  }, [canSubmit, canViewHistory, canViewAudit, activeTab]);

  const handleFormSuccess = () => {
    toast.success("BA usage record submitted successfully!");
  };

  return (
    <div className="space-y-4" data-component="BASkillsPage">
      {/* Header */}
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Log BA Usage
        </h1>
      </div>

      {/* Tabs — only shown when more than one tab is accessible */}
      {showTabs && (
        <div className="border-b border-gray-200 dark:border-gray-700 relative">
          <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
            {canSubmit && (
              <button
                ref={(el) => { tabRefs.current["submit"] = el; }}
                onClick={() => setActiveTab("submit")}
                className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
                  activeTab === "submit"
                    ? "text-red-600 dark:text-red-400 font-bold"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                }`}
              >
                Submit Record
              </button>
            )}
            {canViewHistory && (
              <button
                ref={(el) => { tabRefs.current["history"] = el; }}
                onClick={() => setActiveTab("history")}
                className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
                  activeTab === "history"
                    ? "text-red-600 dark:text-red-400 font-bold"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                }`}
              >
                History
              </button>
            )}
            {canViewAudit && (
              <button
                ref={(el) => { tabRefs.current["audit"] = el; }}
                onClick={() => setActiveTab("audit")}
                className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
                  activeTab === "audit"
                    ? "text-red-600 dark:text-red-400 font-bold"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                }`}
              >
                Audit
              </button>
            )}
          </nav>
          {/* Animated indicator */}
          <div
            className="absolute bottom-0 h-0.5 bg-red-500 dark:bg-red-400 transition-all duration-300 ease-out"
            style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px` }}
          />
        </div>
      )}

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "submit" && canSubmit && (
          <>
            {isMobile ? (
              <>
                <BASkillsForm onSuccess={handleFormSuccess} />
                {/* Info note — visible on mobile */}
                <div className="mt-4 flex gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>BA qualifications require active use at least once every 6 months to remain current.</p>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Log BA Usage</CardTitle>
                      <CardDescription>
                        Record when you or another member used a BA cylinder
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <BASkillsForm onSuccess={handleFormSuccess} />
                    </CardContent>
                  </Card>
                </div>
                <div className="hidden lg:block">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">About BA Skills</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-3">
                      <p>
                        <strong className="text-foreground">6-month rule:</strong> BA qualifications must be maintained by active use at least once every 6 months to stay current.
                      </p>
                      <p>
                        <strong className="text-foreground">Fire Call:</strong> Use this when you wore BA during an actual incident.
                      </p>
                      <p>
                        <strong className="text-foreground">Training/Drill:</strong> Use this for practice sessions and training exercises.
                      </p>
                      <p>
                        You can submit records on behalf of other members if needed.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "history" && canViewHistory && (
          <>
            {isMobile ? (
              <BASkillsRecordList />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Usage History</CardTitle>
                  <CardDescription>
                    View all BA usage records submitted by members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BASkillsRecordList />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === "audit" && canViewAudit && (
          <>
            {isMobile ? (
              <BASkillsAudit />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>BA Skills Audit</CardTitle>
                  <CardDescription>
                    Track members with BA skills and their 6-month qualification status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BASkillsAudit />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
