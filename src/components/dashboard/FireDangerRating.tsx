import { useState, useEffect } from "react";

interface FDRData {
  category: string;
  index: number;
}

interface FDRResponse {
  forecasts: Array<{
    day: string;
    date: string;
    rating: {
      index: number;
      category: string;
    };
  }>;
}

interface TFBData {
  today: boolean;
  tomorrow: boolean;
  dayAfter: boolean;
}

interface EMVConditionsResponse {
  current: {
    tfb: Record<string, string>;
  };
  forecasts: Array<{
    tfb: Record<string, string>;
    date: string;
  }>;
}

const REGION = "Central";
const TFB_ACTIVE = "YES - TOTAL FIRE BAN IN FORCE";

// Toggle this to true to simulate a Total Fire Ban day for testing
const DEBUG_FORCE_TFB = false;

export function FireDangerRating() {
  const [currentFDR, setCurrentFDR] = useState<FDRData | null>(null);
  const [tomorrowFDR, setTomorrowFDR] = useState<FDRData | null>(null);
  const [dayAfterFDR, setDayAfterFDR] = useState<FDRData | null>(null);
  const [tfbStatus, setTfbStatus] = useState<TFBData>({ today: false, tomorrow: false, dayAfter: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch FDR data
        const fdrResponse = await fetch("https://api2.grayhux.io/fdr");
        const fdrData: FDRResponse = await fdrResponse.json();

        if (fdrData.forecasts && fdrData.forecasts.length > 0) {
          setCurrentFDR({
            category: fdrData.forecasts[0].rating.category,
            index: fdrData.forecasts[0].rating.index,
          });
          if (fdrData.forecasts.length > 1) {
            setTomorrowFDR({
              category: fdrData.forecasts[1].rating.category,
              index: fdrData.forecasts[1].rating.index,
            });
          }
          if (fdrData.forecasts.length > 2) {
            setDayAfterFDR({
              category: fdrData.forecasts[2].rating.category,
              index: fdrData.forecasts[2].rating.index,
            });
          }
        }

        // Fetch TFB data
        const tfbResponse = await fetch("https://api2.grayhux.io/emv-conditions");
        const tfbData: EMVConditionsResponse = await tfbResponse.json();

        const tfb: TFBData = {
          today: DEBUG_FORCE_TFB || tfbData.current?.tfb?.[REGION] === TFB_ACTIVE,
          tomorrow: DEBUG_FORCE_TFB || tfbData.forecasts?.[0]?.tfb?.[REGION] === TFB_ACTIVE,
          dayAfter: DEBUG_FORCE_TFB || tfbData.forecasts?.[1]?.tfb?.[REGION] === TFB_ACTIVE,
        };
        setTfbStatus(tfb);

        setError(false);
      } catch (err) {
        console.error("Error fetching FDR/TFB:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh every hour
    const interval = setInterval(fetchData, 3600000);
    return () => clearInterval(interval);
  }, []);

  const getFutureDayName = (daysAhead: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toLocaleDateString("en-AU", { weekday: "short" });
  };

  const capitalizeCategory = (category: string) => {
    return category
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Detect dark mode
  const isDarkMode = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

  const getFDRStyles = (category: string): React.CSSProperties => {
    switch (category?.toUpperCase()) {
      case "CATASTROPHIC":
        return {
          backgroundColor: "#af1917",
          color: "#fff",
          borderColor: "#af1917",
        };
      case "EXTREME":
        return {
          backgroundColor: "#f0820e",
          color: "#000",
          borderColor: "#f0820e",
        };
      case "HIGH":
        return {
          backgroundColor: "#fcdd37",
          color: "#000",
          borderColor: "#fcdd37",
        };
      case "MODERATE":
        return {
          backgroundColor: "#67b436",
          color: "#000",
          borderColor: "#67b436",
        };
      default:
        // Softer colors for "No Rating" state
        return {
          backgroundColor: isDarkMode ? "#374151" : "#f3f4f6",
          color: isDarkMode ? "#9ca3af" : "#374151",
          borderColor: isDarkMode ? "#4b5563" : "#d1d5db",
        };
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 animate-pulse">
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (error || !currentFDR) {
    return null;
  }

  // Compact FDR display matching YouTab style
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded overflow-hidden">
      {/* Header row with title */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-lg font-medium">
          Fire Danger Rating - Central
        </span>
      </div>

      {/* Ratings row - all 3 days inline */}
      <div className="grid grid-cols-3">
        {/* Today */}
        <div
          className="px-3 py-2 border-r border-gray-200 dark:border-gray-700"
          style={getFDRStyles(currentFDR.category)}
        >
          <div className="flex items-center gap-1.5">
            {tfbStatus.today && (
              <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-5 w-5 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-medium opacity-70">
                {tfbStatus.today ? "TFB Today" : "Today"}
              </p>
              <p className="text-sm font-semibold leading-tight truncate">
                {capitalizeCategory(currentFDR.category)}
              </p>
            </div>
          </div>
        </div>

        {/* Tomorrow */}
        {tomorrowFDR && (
          <div
            className="px-3 py-2 border-r border-gray-200 dark:border-gray-700"
            style={getFDRStyles(tomorrowFDR.category)}
          >
            <div className="flex items-center gap-1.5">
              {tfbStatus.tomorrow && (
                <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-4 w-4 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-medium opacity-70">
                  {tfbStatus.tomorrow ? "TFB" : "Tomorrow"}
                </p>
                <p className="text-sm font-semibold leading-tight truncate">
                  {capitalizeCategory(tomorrowFDR.category)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Day After */}
        {dayAfterFDR && (
          <div
            className="px-3 py-2"
            style={getFDRStyles(dayAfterFDR.category)}
          >
            <div className="flex items-center gap-1.5">
              {tfbStatus.dayAfter && (
                <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-4 w-4 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-medium opacity-70">
                  {tfbStatus.dayAfter ? "TFB" : getFutureDayName(2)}
                </p>
                <p className="text-sm font-semibold leading-tight truncate">
                  {capitalizeCategory(dayAfterFDR.category)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
