import { getAppEnvironment } from "@/utils/environment";

/**
 * Detects whether BRAVO is running as an installed PWA and, if not, which
 * install path this device supports. Pure functions take an `InstallEnv`
 * snapshot so they can be unit-tested in node without a DOM; `readInstallEnv`
 * builds that snapshot from the real browser.
 *
 * Platform detection borrows the checks that @khmyznikov/pwa-install settled
 * on: iPadOS reports itself as a Mac, so "Apple mobile" is `Mac` in the UA plus
 * more than two touch points, not an iPhone/iPad string match.
 */

export type InstallPlatform =
  /** Already running standalone. Never prompt. */
  | "installed"
  /** Android Chromium: the browser gives us a native prompt to trigger. */
  | "android-native"
  /** Android without BeforeInstallPromptEvent (Firefox, Opera): menu instructions. */
  | "android-manual"
  /** iPhone/iPad in Safari: Share then Add to Home Screen. */
  | "ios-safari"
  /** iPhone/iPad in Chrome/Edge/Firefox: cannot install, must open Safari. */
  | "ios-other"
  /** Desktop or anything else: no prompt, notifications work in-browser. */
  | "unsupported";

export interface InstallEnv {
  userAgent: string;
  maxTouchPoints: number;
  /** `window.matchMedia("(display-mode: standalone)").matches` */
  displayModeStandalone: boolean;
  /** iOS Safari's `navigator.standalone` */
  navigatorStandalone: boolean;
  /** `"BeforeInstallPromptEvent" in window` */
  hasBeforeInstallPromptEvent: boolean;
  hasServiceWorker: boolean;
}

export function isStandalone(env: InstallEnv): boolean {
  return env.displayModeStandalone || env.navigatorStandalone;
}

export function isAppleMobile(env: InstallEnv): boolean {
  return /Mac|iPhone|iPad|iPod/.test(env.userAgent) && env.maxTouchPoints > 2 && env.hasServiceWorker;
}

/** Third-party browsers on iOS are all WebKit shells and cannot install PWAs. */
export function isAppleMobileNonSafari(env: InstallEnv): boolean {
  return isAppleMobile(env) && /CriOS|EdgiOS|FxiOS|OPiOS|OPT\//.test(env.userAgent);
}

/**
 * Safari's major version from the `Version/26.0` UA token. Do NOT read the OS
 * part: since iOS 26 Apple freezes it at "iPhone OS 18_6" to blunt
 * fingerprinting, so an iOS 27 phone still claims to be iOS 18. iPad UAs are
 * Mac-shaped and never had the OS version, but carry the same Version token.
 */
export function safariMajorVersion(env: InstallEnv): number | null {
  const m = /Version\/(\d+)[.\d]*\s+(?:Mobile\/\S+\s+)?Safari\//.exec(env.userAgent);
  return m ? Number(m[1]) : null;
}

/**
 * iOS 26 redesigned Safari: the toolbar collapses into a single menu button
 * and Share lives inside it, so the "tap Share in the toolbar" instruction is
 * wrong there and on every later release.
 */
export function usesSafari26Toolbar(env: InstallEnv): boolean {
  if (!isAppleMobile(env)) return false;
  const major = safariMajorVersion(env);
  return major !== null && major >= 26;
}

export function isAndroid(env: InstallEnv): boolean {
  return /android/i.test(env.userAgent);
}

export function detectInstallPlatform(env: InstallEnv): InstallPlatform {
  if (isStandalone(env)) return "installed";
  if (isAppleMobile(env)) {
    return isAppleMobileNonSafari(env) ? "ios-other" : "ios-safari";
  }
  if (isAndroid(env)) {
    return env.hasBeforeInstallPromptEvent ? "android-native" : "android-manual";
  }
  return "unsupported";
}

export function readInstallEnv(): InstallEnv {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      userAgent: "",
      maxTouchPoints: 0,
      displayModeStandalone: false,
      navigatorStandalone: false,
      hasBeforeInstallPromptEvent: false,
      hasServiceWorker: false,
    };
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent ?? "",
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    displayModeStandalone:
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches,
    navigatorStandalone: nav.standalone === true,
    hasBeforeInstallPromptEvent: "BeforeInstallPromptEvent" in window,
    hasServiceWorker: "serviceWorker" in nav,
  };
}

// ---------------------------------------------------------------------------
// Testing aid: outside production, `?installPlatform=android-native` (or any
// other platform) forces the detected platform for the rest of the browser
// session, so every variant can be eyeballed from a desktop browser. Ignored on
// production builds.

export const INSTALL_PLATFORM_OVERRIDE_KEY = "bravo:install-platform-override";
const PLATFORMS: readonly InstallPlatform[] = [
  "installed",
  "android-native",
  "android-manual",
  "ios-safari",
  "ios-other",
  "unsupported",
];

export function readInstallPlatformOverride(
  search: string,
  allowed: boolean,
): InstallPlatform | null {
  if (!allowed) return null;
  try {
    const fromQuery = new URLSearchParams(search).get("installPlatform");
    if (fromQuery !== null) {
      if (fromQuery === "" || fromQuery === "off") {
        sessionStorage.removeItem(INSTALL_PLATFORM_OVERRIDE_KEY);
        return null;
      }
      if ((PLATFORMS as readonly string[]).includes(fromQuery)) {
        sessionStorage.setItem(INSTALL_PLATFORM_OVERRIDE_KEY, fromQuery);
        return fromQuery as InstallPlatform;
      }
    }
    const stored = sessionStorage.getItem(INSTALL_PLATFORM_OVERRIDE_KEY);
    return stored && (PLATFORMS as readonly string[]).includes(stored)
      ? (stored as InstallPlatform)
      : null;
  } catch {
    return null;
  }
}

/** Detected platform, honouring the non-production override. Use this, not detectInstallPlatform, from UI code. */
export function resolveInstallPlatform(): InstallPlatform {
  if (typeof window === "undefined") return "unsupported";
  const allowed = getAppEnvironment() !== "production";
  const override = readInstallPlatformOverride(window.location.search, allowed);
  return override ?? detectInstallPlatform(readInstallEnv());
}

// ---------------------------------------------------------------------------
// Snooze: "Not now" hides the prompt for a week rather than forever. Members
// who forget get reminded; members who genuinely want a browser tab are not
// nagged on every page load.

export const INSTALL_SNOOZE_KEY = "bravo:install-prompt-snoozed-until";
export const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** Auth page card is dismissed for the session only; it is passive, so no week-long snooze. */
export const INSTALL_NUDGE_DISMISSED_KEY = "bravo:install-nudge-dismissed";

export function isInstallNudgeDismissed(): boolean {
  try {
    return sessionStorage.getItem(INSTALL_NUDGE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissInstallNudge(): void {
  try {
    sessionStorage.setItem(INSTALL_NUDGE_DISMISSED_KEY, "1");
  } catch {
    // ignore
  }
}

/** Phone browser tabs only: the platforms where an install changes anything. */
export function isPhoneBrowserTab(platform: InstallPlatform): boolean {
  return platform !== "installed" && platform !== "unsupported";
}

export function isInstallPromptSnoozed(now: number = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(INSTALL_SNOOZE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

export function snoozeInstallPrompt(now: number = Date.now()): void {
  try {
    localStorage.setItem(INSTALL_SNOOZE_KEY, String(now + INSTALL_SNOOZE_MS));
  } catch {
    // Private mode or storage blocked: the prompt simply shows again next load.
  }
}

export function clearInstallPromptSnooze(): void {
  try {
    localStorage.removeItem(INSTALL_SNOOZE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Stable per-browser-profile id for launch telemetry. On iOS the installed app
 * has its own localStorage, so it gets its own id, which is exactly the split
 * we want to see.
 */
export const DEVICE_ID_KEY = "bravo:device-id";

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, fresh);
    return fresh;
  } catch {
    return "no-storage";
  }
}

/**
 * Settings pages can ask the mounted <InstallPrompt> to open on demand, so the
 * instructions stay reachable after the one-off prompt has been snoozed.
 */
export const OPEN_INSTALL_PROMPT_EVENT = "bravo:open-install-prompt";

export function openInstallPrompt(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_INSTALL_PROMPT_EVENT));
}
