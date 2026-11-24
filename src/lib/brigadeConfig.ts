/**
 * Deployment-specific brigade identity and integration endpoints, read from
 * public `VITE_*` environment variables so any brigade can run BRAVO without
 * editing source code.
 *
 * All values have generic fallbacks when unset. See `.env.example`.
 */

function envText(value: string | undefined): string {
  return value?.trim() ?? "";
}

const configuredName = envText(import.meta.env.VITE_BRIGADE_NAME);

/** Brigade base name, e.g. "Wyndham Vale", or "" when unconfigured. */
export const BRIGADE_NAME = configuredName;

/** Full display name shown in headers and reports. */
export const BRIGADE_FULL_NAME =
  envText(import.meta.env.VITE_BRIGADE_FULL_NAME) ||
  (configuredName ? `${configuredName} Fire Brigade` : "BRAVO");

/** Compact name used on narrow phone headers. */
export const BRIGADE_SHORT_NAME =
  envText(import.meta.env.VITE_BRIGADE_SHORT_NAME) ||
  (configuredName ? `${configuredName} FB` : "BRAVO");

/** Short brigade code used in page titles and calendar UIDs (e.g. "WVFB"). */
export const BRIGADE_CODE =
  envText(import.meta.env.VITE_BRIGADE_CODE) || "BRAVO";

/** Station heading shown on the wall kiosk dashboard. */
export const STATION_NAME =
  envText(import.meta.env.VITE_STATION_NAME) ||
  (configuredName ? `${configuredName} Fire Station` : "Fire Station");

/** Quick-pick appliance chips for crewing forms (comma-separated in env). */
export const QUICK_APPLIANCES: string[] = (() => {
  const raw = envText(import.meta.env.VITE_QUICK_APPLIANCES);
  if (!raw) return ["Pumper", "Tanker", "FCV"];
  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : ["Pumper", "Tanker", "FCV"];
})();

/** Optional Fire Danger Rating / EMV conditions API base URL (no trailing slash). */
export const FDR_API_BASE = envText(import.meta.env.VITE_FDR_API_URL).replace(
  /\/+$/,
  "",
);

/** Optional parent domain for cross-app SSO cookies and iframe refresh (e.g. "example.org"). */
export const SSO_DOMAIN = envText(import.meta.env.VITE_SSO_DOMAIN).replace(
  /^\.+/,
  "",
);
