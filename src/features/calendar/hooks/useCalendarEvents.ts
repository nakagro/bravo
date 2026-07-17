import { useCallback, useSyncExternalStore } from "react";
import { addMonths } from "date-fns";
import { parseIcs, type CalendarEvent } from "../lib/parseIcs";

// Radicale returns the whole collection in one response, so a single shared
// fetch serves both the dashboard widget and the calendar page; month
// navigation never triggers a request.

const PAST_MONTHS = 12;
const FUTURE_MONTHS = 18;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Self-hosted Convex serves HTTP actions on the deployment origin under
 * `/http`; Convex Cloud serves them on the `.convex.site` domain without a
 * prefix.
 */
export function getCalendarEventsUrl(): string {
  const convexUrl = import.meta.env.VITE_CONVEX_URL || "http://localhost:3210";
  if (convexUrl.includes(".convex.cloud")) {
    return `${convexUrl.replace(".convex.cloud", ".convex.site")}/calendar/events`;
  }
  return `${convexUrl}/http/calendar/events`;
}

interface CalendarStore {
  events: CalendarEvent[] | null;
  error: string | null;
  fetchedAt: number;
}

let store: CalendarStore = { events: null, error: null, fetchedAt: 0 };
const listeners = new Set<() => void>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;

function setStore(patch: Partial<CalendarStore>) {
  store = { ...store, ...patch };
  listeners.forEach((listener) => listener());
}

function fetchCalendarEvents(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetch(getCalendarEventsUrl(), {
        headers: { Accept: "text/calendar" },
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch calendar: ${response.status} ${response.statusText}`,
        );
      }
      const icsData = await response.text();
      const now = new Date();
      const events = parseIcs(
        icsData,
        addMonths(now, -PAST_MONTHS),
        addMonths(now, FUTURE_MONTHS),
      );
      setStore({ events, error: null, fetchedAt: Date.now() });
    } catch (err) {
      console.error("Error fetching calendar events:", err);
      setStore({
        error:
          err instanceof Error ? err.message : "Failed to fetch calendar events",
      });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function handleVisibilityChange() {
  // Refetch when a resumed PWA comes back to the foreground with stale data
  if (
    document.visibilityState === "visible" &&
    Date.now() - store.fetchedAt > STALE_AFTER_MS
  ) {
    void fetchCalendarEvents();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    refreshTimer = setInterval(
      () => void fetchCalendarEvents(),
      REFRESH_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  if (store.events === null && !inflight) {
    void fetchCalendarEvents();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
}

export function useCalendarEvents() {
  const snapshot = useSyncExternalStore(subscribe, () => store);
  const refresh = useCallback(() => void fetchCalendarEvents(), []);

  const hasLoaded = snapshot.events !== null;
  return {
    events: snapshot.events ?? [],
    hasLoaded,
    /** True only on the very first load; stale data renders while refreshing */
    loading: !hasLoaded && snapshot.error === null,
    error: snapshot.error,
    refresh,
  };
}
