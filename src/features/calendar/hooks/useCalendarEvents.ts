import { useCallback, useSyncExternalStore } from "react";
import { useAction } from "convex/react";
import { addMonths } from "date-fns";
import { api } from "../../../../convex/_generated/api";
import { parseIcs, type CalendarEvent } from "../lib/parseIcs";
import { errorMessage } from "@/lib/errors";

// Radicale returns the whole collection in one response, so a single shared
// fetch serves both the dashboard widget and the calendar page; month
// navigation never triggers a request.

const PAST_MONTHS = 12;
const FUTURE_MONTHS = 18;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const STALE_AFTER_MS = 10 * 60 * 1000;

interface CalendarStore {
  events: CalendarEvent[] | null;
  error: string | null;
  fetchedAt: number;
}

let store: CalendarStore = { events: null, error: null, fetchedAt: 0 };
const listeners = new Set<() => void>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;
let activeFetcher: (() => Promise<string>) | null = null;

function setStore(patch: Partial<CalendarStore>) {
  store = { ...store, ...patch };
  listeners.forEach((listener) => listener());
}

function fetchCalendarEvents(fetchIcs?: () => Promise<string>): Promise<void> {
  if (inflight) return inflight;
  const fetcher = fetchIcs ?? activeFetcher;
  if (!fetcher) return Promise.resolve();
  inflight = (async () => {
    try {
      const icsData = await fetcher();
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
          errorMessage(err, "Failed to fetch calendar events"),
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

function subscribe(
  listener: () => void,
  fetcher: () => Promise<string>,
): () => void {
  listeners.add(listener);
  activeFetcher = fetcher;
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
      activeFetcher = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
}

export function useCalendarEvents() {
  const getCalendarEvents = useAction(api.calendarWrite.getCalendarEvents);
  const subscribeToCalendar = useCallback(
    (listener: () => void) => subscribe(listener, getCalendarEvents),
    [getCalendarEvents],
  );
  const snapshot = useSyncExternalStore(subscribeToCalendar, () => store);
  const refresh = useCallback(
    () => void fetchCalendarEvents(getCalendarEvents),
    [getCalendarEvents],
  );

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
