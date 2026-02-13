/**
 * Detect whether the app is running against the dev/cloud Convex instance.
 * Returns true if VITE_CONVEX_URL contains ".convex.cloud" (Convex Cloud),
 * which is the dev/test environment. Production uses the self-hosted VPS.
 */
export function isDevEnvironment(): boolean {
  const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "";
  return convexUrl.includes(".convex.cloud");
}
