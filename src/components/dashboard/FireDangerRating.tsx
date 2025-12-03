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

export function FireDangerRating() {
  const [currentFDR, setCurrentFDR] = useState<FDRData | null>(null);
  const [tomorrowFDR, setTomorrowFDR] = useState<FDRData | null>(null);
  const [dayAfterFDR, setDayAfterFDR] = useState<FDRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchFDR = async () => {
      try {
        const response = await fetch("https://api2.grayhux.io/fdr");
        const data: FDRResponse = await response.json();

        if (data.forecasts && data.forecasts.length > 0) {
          setCurrentFDR({
            category: data.forecasts[0].rating.category,
            index: data.forecasts[0].rating.index,
          });
          if (data.forecasts.length > 1) {
            setTomorrowFDR({
              category: data.forecasts[1].rating.category,
              index: data.forecasts[1].rating.index,
            });
          }
          if (data.forecasts.length > 2) {
            setDayAfterFDR({
              category: data.forecasts[2].rating.category,
              index: data.forecasts[2].rating.index,
            });
          }
          setError(false);
        }
      } catch (err) {
        console.error("Error fetching FDR:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchFDR();

    // Refresh every hour
    const interval = setInterval(fetchFDR, 3600000);
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
        return {
          backgroundColor: "#fff",
          color: "#000",
          borderColor: "#000",
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
        <p className="text-xs font-medium opacity-80">Fire Danger (Central)</p>
        <p className="text-base font-semibold">{capitalizeCategory(currentFDR.category)}</p>
      </div>

      {/* Future forecasts - compact badges */}
      {tomorrowFDR && (
        <div
          className="rounded-lg shadow-sm px-3 py-2.5 text-center min-w-[80px]"
          style={getFDRStyles(tomorrowFDR.category)}
        >
          <p className="text-[10px] font-medium opacity-80 leading-tight">Tomorrow</p>
          <p className="text-sm font-semibold leading-tight">{capitalizeCategory(tomorrowFDR.category)}</p>
        </div>
      )}
      {dayAfterFDR && (
        <div
          className="rounded-lg shadow-sm px-3 py-2.5 text-center min-w-[80px]"
          style={getFDRStyles(dayAfterFDR.category)}
        >
          <p className="text-[10px] font-medium opacity-80 leading-tight">{getFutureDayName(2)}</p>
          <p className="text-sm font-semibold leading-tight">{capitalizeCategory(dayAfterFDR.category)}</p>
        </div>
      )}
    </div>
  );
}
