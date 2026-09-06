import type { Doc } from "../_generated/dataModel";

export const LAUNCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type PhoneInstallStatus =
  /** Opened the installed app on a phone within the window. */
  | "installed"
  /** Phone launches in the window, every one from a browser tab. */
  | "browser-only"
  /** No phone launch in the window (desktop only, or nothing recorded). */
  | "none";

export interface LaunchSummary {
  phoneInstall: PhoneInstallStatus;
  lastInstalledLaunchAt?: number;
  lastBrowserLaunchAt?: number;
}

type Launch = Pick<Doc<"userLaunches">, "displayMode" | "deviceClass" | "lastLaunchAt">;

/**
 * Collapse a member's launch rows into the one signal officers act on. A
 * member who installed on their phone but also opens a laptop tab is fine;
 * only phone launches count towards "browser-only".
 */
export function summarizeLaunches(launches: Launch[], now: number): LaunchSummary {
  const since = now - LAUNCH_WINDOW_MS;
  let lastInstalled: number | undefined;
  let lastBrowser: number | undefined;
  for (const l of launches) {
    if (l.deviceClass !== "phone" || l.lastLaunchAt < since) continue;
    if (l.displayMode === "installed") {
      lastInstalled = Math.max(lastInstalled ?? 0, l.lastLaunchAt);
    } else {
      lastBrowser = Math.max(lastBrowser ?? 0, l.lastLaunchAt);
    }
  }
  const phoneInstall: PhoneInstallStatus =
    lastInstalled !== undefined ? "installed" : lastBrowser !== undefined ? "browser-only" : "none";
  return { phoneInstall, lastInstalledLaunchAt: lastInstalled, lastBrowserLaunchAt: lastBrowser };
}
