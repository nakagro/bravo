import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { fdrAppearance, fdrLabel, NO_RATING_CARD_CLASSES } from "./fdrLevels";

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


// --- Startup timing helper ---
const _t = (label: string) => (window as any).__BRAVO_T?.(label);

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
        _t("FDR fetch start");
        const fdrResponse = await fetch("https://api2.grayhux.io/fdr");
        const fdrData: FDRResponse = await fdrResponse.json();
        _t("FDR fetch complete");

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
        _t("TFB fetch start");
        const tfbResponse = await fetch("https://api2.grayhux.io/emv-conditions");
        const tfbData: EMVConditionsResponse = await tfbResponse.json();
        _t("TFB fetch complete");

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

  const badge = (category: string) => fdrAppearance(category, NO_RATING_CARD_CLASSES);

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
    <Link
      to="/fdr"
      className="group flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Fire danger ratings for all districts"
    >
      {/* Today's FDR - colored and prominent */}
      <div
        className={`flex-1 rounded-lg shadow-sm px-4 py-2.5 ${badge(currentFDR.category).className}`}
        style={badge(currentFDR.category).style}
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
            <p className="text-base font-semibold">{fdrLabel(currentFDR.category)}</p>
          </div>
        </div>
      </div>

      {/* Future forecasts - compact badges */}
      {tomorrowFDR && (
        <div
          className={`rounded-lg shadow-sm px-3 py-2.5 text-center min-w-[80px] ${badge(tomorrowFDR.category).className}`}
          style={badge(tomorrowFDR.category).style}
        >
          <p className="text-[10px] font-medium opacity-80 leading-tight">Tomorrow</p>
          <div className="flex items-center justify-center gap-1">
            {tfbStatus.tomorrow && (
              <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-4 w-4" />
            )}
            <p className="text-sm font-semibold leading-tight">{fdrLabel(tomorrowFDR.category)}</p>
          </div>
        </div>
      )}
      {dayAfterFDR && (
        <div
          className={`rounded-lg shadow-sm px-3 py-2.5 text-center min-w-[80px] ${badge(dayAfterFDR.category).className}`}
          style={badge(dayAfterFDR.category).style}
        >
          <p className="text-[10px] font-medium opacity-80 leading-tight">{getFutureDayName(2)}</p>
          <div className="flex items-center justify-center gap-1">
            {tfbStatus.dayAfter && (
              <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-4 w-4" />
            )}
            <p className="text-sm font-semibold leading-tight">{fdrLabel(dayAfterFDR.category)}</p>
          </div>
        </div>
      )}
      <ChevronRight
        className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
