import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { PostHogProvider } from "posthog-js/react";
import "./index.css";
import App from "./App";
import { syncConvexDebugFlagFromUrl } from "./lib/debug/convexDebug";

// --- Startup timing instrumentation ---
const __BRAVO_START = performance.now();
(window as any).__BRAVO_START = __BRAVO_START;
const _t = (label: string) => console.log(`[BRAVO +${Math.round(performance.now() - __BRAVO_START)}ms] ${label}`);
(window as any).__BRAVO_T = _t;
_t("Module loaded");

const convexDebugEnabled = syncConvexDebugFlagFromUrl();
if (convexDebugEnabled) {
  _t("Convex verbose debug enabled");
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string, {
  verbose: convexDebugEnabled,
});
_t("ConvexReactClient created");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        defaults: "2025-05-24",
        capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
        debug: import.meta.env.MODE === "development",
      }}
    >
      <ConvexAuthProvider client={convex}>
        <App />
      </ConvexAuthProvider>
    </PostHogProvider>
  </StrictMode>,
);
