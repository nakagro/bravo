import { useState, useEffect, useRef } from "react";
import { BASkillsForm, BASkillsRecordList } from "@/features/baSkills/components";

export function BASkillsPage() {
  const [activeTab, setActiveTab] = useState("submit");
  const [showSuccess, setShowSuccess] = useState(false);

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

  const handleFormSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="space-y-4" data-component="BASkillsPage">
      {/* Header */}
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            BA Skills Maintenance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            MSA G1E BA Set Skills Maintenance
          </p>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
          ✓ BA usage record submitted successfully!
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 relative">
        <nav className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative">
          <button
            ref={(el) => {
              tabRefs.current["submit"] = el;
            }}
            onClick={() => setActiveTab("submit")}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === "submit"
                ? "text-red-600 dark:text-red-400 font-bold"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
            }`}
          >
            Submit Record
          </button>
          <button
            ref={(el) => {
              tabRefs.current["history"] = el;
            }}
            onClick={() => setActiveTab("history")}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === "history"
                ? "text-red-600 dark:text-red-400 font-bold"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
            }`}
          >
            History
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
        {activeTab === "submit" && (
          <div className="max-w-xl">
            <BASkillsForm onSuccess={handleFormSuccess} />
          </div>
        )}
        {activeTab === "history" && <BASkillsRecordList />}
      </div>
    </div>
  );
}
