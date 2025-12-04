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

  return (
    <div className="flex items-center gap-2">
      {/* Today's FDR - colored and prominent */}
      <div
        className="flex-1 rounded-lg shadow-sm px-4 py-2.5"
        style={getFDRStyles(currentFDR.category)}
      >
        <div className="flex items-center gap-2">
          {tfbStatus.today && (
            <img
              src="/icons/tfb_icon_big.png"
              alt="Total Fire Ban"
              className="h-8 w-8"
            />
          )}
          <div>
            <p className="text-xs font-medium opacity-80">
              {tfbStatus.today ? "Total Fire Ban" : "Fire Danger"}
            </p>
            <p className="text-base font-semibold">{capitalizeCategory(currentFDR.category)}</p>
          </div>
        </div>
      </div>

      {/* Future forecasts - compact badges */}
      {tomorrowFDR && (
        <div
          className="rounded-lg shadow-sm px-3 py-2.5 text-center min-w-[80px]"
          style={getFDRStyles(tomorrowFDR.category)}
        >
          <p className="text-[10px] font-medium opacity-80 leading-tight">Tomorrow</p>
          <div className="flex items-center justify-center gap-1">
            {tfbStatus.tomorrow && (
              <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-4 w-4" />
            )}
            <p className="text-sm font-semibold leading-tight">{capitalizeCategory(tomorrowFDR.category)}</p>
          </div>
        </div>
      )}
      {dayAfterFDR && (
        <div
          className="rounded-lg shadow-sm px-3 py-2.5 text-center min-w-[80px]"
          style={getFDRStyles(dayAfterFDR.category)}
        >
          <p className="text-[10px] font-medium opacity-80 leading-tight">{getFutureDayName(2)}</p>
          <div className="flex items-center justify-center gap-1">
            {tfbStatus.dayAfter && (
              <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-4 w-4" />
            )}
            <p className="text-sm font-semibold leading-tight">{capitalizeCategory(dayAfterFDR.category)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
