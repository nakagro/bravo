import * as Sentry from "@sentry/react";

// Prefer environment variables if provided, with fallback to the supplied DSN
const dsn = (import.meta as any).env?.VITE_SENTRY_DSN ?? "https://2457d4659e5cd4f6eda3a3a2f6a25391@o4509802251354112.ingest.us.sentry.io/4509802253123584";
const tracesSampleRate = Number((import.meta as any).env?.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "1.0");
// Determine environment based on hostname with optional override
const environment = (() => {
  const override = (import.meta as any).env?.VITE_SENTRY_ENV as string | undefined;
  if (override) return override; // explicit override wins

  // Avoid touching window during SSR/build
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    return "development";
  }
  if (hostname === "wydv-hose.grayhux.io") {
    return "production";
  }
  // Fallback to Vite mode if hostname is something else (e.g., preview)
  return (import.meta as any).env?.MODE ?? "development";
})();

// Initialize Sentry as early as possible
Sentry.init({
  dsn,
  environment,
  integrations: [
    // Basic browser tracing (XHR/fetch, history, etc.)
    Sentry.browserTracingIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  // Send console logs to Sentry (info/warn/error)
  enableLogs: true,
  // Capture 100% of transactions by default (adjust via VITE_SENTRY_TRACES_SAMPLE_RATE)
  tracesSampleRate,
  // Propagate tracing headers for same-origin and Convex backends
  tracePropagationTargets: [
    /^\//,
    /^https:\/\/.*convex\.cloud/,
    /^https:\/\/convex\.grayhux\.io/,
  ],
});
