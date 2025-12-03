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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

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
        return { backgroundColor: "#e5e7eb", color: "#374151" };
    }
  };

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

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {[
          { rating: "Moderate", style: getFDRStyles("Moderate") },
          { rating: "High", style: getFDRStyles("High") },
          { rating: "Extreme", style: getFDRStyles("Extreme") },
          { rating: "Catastrophic", style: getFDRStyles("Catastrophic") },
        ].map(({ rating, style }) => (
          <span
            key={rating}
            className="px-2 py-0.5 rounded font-medium"
            style={style}
          >
            {rating}
          </span>
        ))}
      </div>

      {/* Mobile: Card-based layout */}
      {isMobile ? (
        <div className="space-y-3">
          {data?.regions.map((region) => (
            <Card key={region.description}>
              <CardContent className="p-3">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2">
                  {region.description}
                </h3>
                <div className="grid grid-cols-4 gap-1.5">
                  {region.forecasts.map((forecast, idx) => (
                    <div
                      key={idx}
                      className="rounded p-1.5 text-center"
                      style={getFDRStyles(forecast.rating)}
                    >
                      <p className="text-[10px] opacity-80 leading-tight">
                        {getDayLabel(idx, forecast.startDate)}
                      </p>
                      <p className="text-xs font-semibold leading-tight">
                        {forecast.rating.toUpperCase() === "NO RATING" 
                          ? "No Rating" 
                          : capitalizeRating(forecast.rating)}
                      </p>
                      <p className="text-[9px] opacity-70">{forecast.index}</p>
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
                      {region.description}
                    </td>
                    {region.forecasts.map((forecast, idx) => (
                      <td key={idx} className="p-2 text-center">
                        <div
                          className="inline-flex flex-col items-center justify-center rounded px-2 py-1.5 min-w-[80px]"
                          style={getFDRStyles(forecast.rating)}
                        >
                          <span className="font-semibold text-xs">
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
        Data sourced from Bureau of Meteorology. FBI thresholds: Moderate (12-24), High (24-50), Extreme (50-100), Catastrophic (100+).
      </p>
    </div>
  );
}

export default FDRPage;
