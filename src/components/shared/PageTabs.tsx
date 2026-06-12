import { useRef, useState, useEffect } from "react";

interface Tab {
  key: string;
  label: string;
  badgeCount?: number;
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

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextKey = tabs[nextIndex].key;
    onChange(nextKey);
    tabRefs.current[nextKey]?.focus();
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 relative">
      <nav
        role="tablist"
        aria-label={ariaLabel}
        className="flex flex-wrap gap-x-2 sm:gap-x-4 -mb-px relative"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[tab.key] = el;
            }}
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`relative py-2 px-2 sm:px-3 min-h-[44px] text-sm transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "text-red-600 dark:text-red-400 font-bold"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
            }`}
          >
            {tab.label}
            {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
              <span
                className="absolute -top-1 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5"
                aria-label={`${tab.badgeCount > 99 ? "99+" : tab.badgeCount} unread`}
              >
                {tab.badgeCount > 99 ? "99+" : tab.badgeCount}
              </span>
            )}
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
