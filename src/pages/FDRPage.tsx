import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface RegionForecast {
  description: string;
  forecasts: Array<{
    index: number;
    date: string;
    startDate: string;
    rating: string;
  }>;
}

interface ParsedFDRData {
  issueTime: string;
  regions: RegionForecast[];
}

// TFB data structure from EMV conditions API
interface TFBData {
  current: Record<string, string>;
  forecasts: Array<Record<string, string>>;
}

const TFB_ACTIVE = "YES - TOTAL FIRE BAN IN FORCE";

// Muted tones for "No Rating"; one step lighter than the gray-800 cards they sit on.
const NO_RATING_CLASSES = "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";

// Region display order (Central first, then alphabetical)
const REGION_ORDER = [
  "Central",
  "East Gippsland",
  "Mallee",
  "North Central",
  "North East",
  "Northern Country",
  "South West",
  "West and South Gippsland",
  "Wimmera",
];

export function FDRPage() {
  const [data, setData] = useState<ParsedFDRData | null>(null);
  const [tfbData, setTfbData] = useState<TFBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch("https://api2.grayhux.io/fdr-all");
      const xmlText = await response.text();

      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      // Get issue time
      const issueTimeEl = xmlDoc.querySelector("issue-time-local");
      const issueTime = issueTimeEl?.textContent || "";

      // Get all fire district areas
      const areas = xmlDoc.querySelectorAll('area[type="fire-district"]');
      const regions: RegionForecast[] = [];

      areas.forEach((area) => {
        const description = area.getAttribute("description") || "";
        const forecastPeriods = area.querySelectorAll("forecast-period");
        const forecasts: RegionForecast["forecasts"] = [];

        forecastPeriods.forEach((period) => {
          const indexEl = period.querySelector('element[type="fire_behaviour_index"]');
          const ratingEl = period.querySelector('text[type="fire_danger"]');
          const startDate = period.getAttribute("start-time-local") || "";

          forecasts.push({
            index: parseInt(indexEl?.textContent || "0", 10),
            date: period.getAttribute("index") || "",
            startDate,
            rating: ratingEl?.textContent || "No Rating",
          });
        });

        regions.push({ description, forecasts });
      });

      // Sort regions by preferred order
      regions.sort((a, b) => {
        const aIndex = REGION_ORDER.indexOf(a.description);
        const bIndex = REGION_ORDER.indexOf(b.description);
        if (aIndex === -1 && bIndex === -1) return a.description.localeCompare(b.description);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

      setData({ issueTime, regions });

      // Fetch TFB data from EMV conditions API
      try {
        const tfbResponse = await fetch("https://api2.grayhux.io/emv-conditions");
        const tfbJson = await tfbResponse.json();
        setTfbData({
          current: tfbJson.current?.tfb || {},
          forecasts: tfbJson.forecasts?.map((f: any) => f.tfb || {}) || [],
        });
      } catch (tfbErr) {
        console.error("Error fetching TFB data:", tfbErr);
        // Non-critical, continue without TFB data
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching FDR data:", err);
      setError("Failed to load fire danger ratings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Refresh every 30 minutes
    const interval = setInterval(fetchData, 1800000);
    return () => clearInterval(interval);
  }, []);

  const getFDRStyles = (rating: string): React.CSSProperties => {
    switch (rating?.toUpperCase()) {
      case "CATASTROPHIC":
        return { backgroundColor: "#af1917", color: "#fff" };
      case "EXTREME":
        return { backgroundColor: "#f0820e", color: "#000" };
      case "HIGH":
        return { backgroundColor: "#fcdd37", color: "#000" };
      case "MODERATE":
        return { backgroundColor: "#67b436", color: "#000" };
      default:
        // "No Rating" is styled by NO_RATING_CLASSES instead, so it follows the
        // app's dark mode toggle.
        return {};
    }
  };

  const isRated = (rating: string) =>
    ["CATASTROPHIC", "EXTREME", "HIGH", "MODERATE"].includes(rating?.toUpperCase());

  const fdrClasses = (rating: string) => (isRated(rating) ? "" : NO_RATING_CLASSES);

  const capitalizeRating = (rating: string) => {
    return rating
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  };

  const formatIssueTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Fire Danger Ratings</h1>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <span>Loading fire danger ratings…</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Fire Danger Ratings</h1>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get forecast dates from first region
  const forecastDates = data?.regions[0]?.forecasts.map((f) => f.startDate) || [];

  const getDayLabel = (idx: number, dateStr: string) => {
    if (idx === 0) return "Today";
    if (idx === 1) return "Tomorrow";
    return formatDate(dateStr);
  };

  // Check if a region has TFB for a specific forecast day
  const hasTFB = (regionName: string, dayIndex: number): boolean => {
    if (!tfbData) return false;
    if (dayIndex === 0) {
      return tfbData.current[regionName] === TFB_ACTIVE;
    }
    // forecasts[0] is tomorrow, forecasts[1] is day after, etc.
    const forecastIdx = dayIndex - 1;
    return tfbData.forecasts[forecastIdx]?.[regionName] === TFB_ACTIVE;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-2">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Fire Danger Ratings</h1>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Issue time */}
      {data?.issueTime && (
        <p className="text-xs text-muted-foreground">
          Issued: {formatIssueTime(data.issueTime)}
        </p>
      )}

      {/* Legend with FBI thresholds */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {[
          { rating: "No Rating", fbi: "< 12", style: getFDRStyles("No Rating") },
          { rating: "Moderate", fbi: "12-23", style: getFDRStyles("Moderate") },
          { rating: "High", fbi: "24-49", style: getFDRStyles("High") },
          { rating: "Extreme", fbi: "50-99", style: getFDRStyles("Extreme") },
          { rating: "Catastrophic", fbi: "≥ 100", style: getFDRStyles("Catastrophic") },
        ].map(({ rating, fbi, style }) => (
          <div
            key={rating}
            className={`flex flex-col items-center px-2 py-1 rounded ${fdrClasses(rating)}`}
            style={style}
          >
            <span className="font-semibold">{rating}</span>
            <span className="text-[10px] opacity-80">({fbi})</span>
          </div>
        ))}
      </div>

      {/* Mobile: Card-based layout */}
      {isMobile ? (
        <div className="space-y-3">
          {data?.regions.map((region) => (
            <Card key={region.description}>
              <CardContent className="p-3">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1.5">
                  {hasTFB(region.description, 0) && (
                    <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-4 w-4" />
                  )}
                  {region.description}
                  {hasTFB(region.description, 0) && (
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">TOTAL FIRE BAN</span>
                  )}
                </h3>
                <div className="grid grid-cols-4 gap-1.5">
                  {region.forecasts.map((forecast, idx) => (
                    <div
                      key={idx}
                      className={`rounded p-1.5 text-center ${fdrClasses(forecast.rating)}`}
                      style={getFDRStyles(forecast.rating)}
                    >
                      <p className="text-[10px] opacity-80 leading-tight flex items-center justify-center gap-0.5">
                        {hasTFB(region.description, idx) && (
                          <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-3 w-3" />
                        )}
                        {getDayLabel(idx, forecast.startDate)}
                      </p>
                      <p className="text-xs font-semibold leading-tight">
                        {forecast.rating.toUpperCase() === "NO RATING" 
                          ? "No Rating" 
                          : capitalizeRating(forecast.rating)}{" "}
                        <span className="font-normal opacity-80">{forecast.index}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop: Table layout */
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left p-3 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-card z-10">
                    Region
                  </th>
                  {forecastDates.map((date, idx) => (
                    <th
                      key={idx}
                      className="text-center p-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[100px]"
                    >
                      {getDayLabel(idx, date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.regions.map((region) => (
                  <tr
                    key={region.description}
                    className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <td className="p-3 font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-card z-10">
                      <span className="flex items-center gap-1.5">
                        {hasTFB(region.description, 0) && (
                          <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-4 w-4" />
                        )}
                        {region.description}
                        {hasTFB(region.description, 0) && (
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">TOTAL FIRE BAN</span>
                        )}
                      </span>
                    </td>
                    {region.forecasts.map((forecast, idx) => (
                      <td key={idx} className="p-2 text-center">
                        <div
                          className={`inline-flex flex-col items-center justify-center rounded px-2 py-1.5 min-w-[80px] ${fdrClasses(forecast.rating)}`}
                          style={getFDRStyles(forecast.rating)}
                        >
                          <span className="font-semibold text-xs flex items-center gap-1">
                            {hasTFB(region.description, idx) && (
                              <img src="/icons/tfb_icon_big.png" alt="TFB" className="h-3.5 w-3.5" />
                            )}
                            {capitalizeRating(forecast.rating)}
                          </span>
                          <span className="text-[10px] opacity-80">
                            FBI: {forecast.index}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Footer info */}
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Data sourced from Bureau of Meteorology.
      </p>
    </div>
  );
}

export default FDRPage;
