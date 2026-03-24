import { useRef, useState, useEffect } from "react";

interface Tab {
  key: string;
  label: string;
}

interface PageTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
}

export function PageTabs({ tabs, activeTab, onChange, ariaLabel = "Page tabs" }: PageTabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab]);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 relative">
      <nav
        role="tablist"
        aria-label={ariaLabel}
        className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative"
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[tab.key] = el;
            }}
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className={`py-2 px-2 sm:px-3 text-sm transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "text-red-600 dark:text-red-400 font-bold"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
            }`}
          >
            {tab.label}
          </button>
        ))}
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
  );
}
