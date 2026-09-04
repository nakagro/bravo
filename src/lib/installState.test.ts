import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectInstallPlatform,
  INSTALL_SNOOZE_KEY,
  INSTALL_SNOOZE_MS,
  isInstallPromptSnoozed,
  snoozeInstallPrompt,
  type InstallEnv,
} from "./installState";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const ANDROID_FIREFOX =
  "Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0";
const MAC_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const WINDOWS_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function env(overrides: Partial<InstallEnv>): InstallEnv {
  return {
    userAgent: "",
    maxTouchPoints: 0,
    displayModeStandalone: false,
    navigatorStandalone: false,
    hasBeforeInstallPromptEvent: false,
    hasServiceWorker: true,
    ...overrides,
  };
}

describe("detectInstallPlatform", () => {
  it("reports installed when running standalone, whatever the device", () => {
    expect(
      detectInstallPlatform(env({ userAgent: ANDROID_CHROME, displayModeStandalone: true })),
    ).toBe("installed");
    expect(
      detectInstallPlatform(
        env({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5, navigatorStandalone: true }),
      ),
    ).toBe("installed");
  });

  it("detects iPhone Safari", () => {
    expect(detectInstallPlatform(env({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 }))).toBe(
      "ios-safari",
    );
  });

  it("detects iPad Safari even though it claims to be a Mac", () => {
    expect(detectInstallPlatform(env({ userAgent: IPAD_SAFARI, maxTouchPoints: 5 }))).toBe(
      "ios-safari",
    );
  });

  it("does not mistake a desktop Mac for an iPad", () => {
    expect(detectInstallPlatform(env({ userAgent: MAC_DESKTOP, maxTouchPoints: 0 }))).toBe(
      "unsupported",
    );
  });

  it("sends Chrome-on-iPhone users to Safari", () => {
    expect(detectInstallPlatform(env({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 }))).toBe(
      "ios-other",
    );
  });

  it("uses the native prompt on Android Chromium", () => {
    expect(
      detectInstallPlatform(
        env({ userAgent: ANDROID_CHROME, maxTouchPoints: 5, hasBeforeInstallPromptEvent: true }),
      ),
    ).toBe("android-native");
  });

  it("falls back to menu instructions on Android browsers without the event", () => {
    expect(detectInstallPlatform(env({ userAgent: ANDROID_FIREFOX, maxTouchPoints: 5 }))).toBe(
      "android-manual",
    );
  });

  it("never prompts on desktop, even with a native prompt available", () => {
    expect(
      detectInstallPlatform(env({ userAgent: WINDOWS_DESKTOP, hasBeforeInstallPromptEvent: true })),
    ).toBe("unsupported");
  });
});

describe("install prompt snooze", () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it("is not snoozed by default", () => {
    vi.stubGlobal("localStorage", fakeStorage);
    expect(isInstallPromptSnoozed()).toBe(false);
  });

  it("snoozes for a week, then shows again", () => {
    vi.stubGlobal("localStorage", fakeStorage);
    const now = 1_000_000;
    snoozeInstallPrompt(now);
    expect(store.get(INSTALL_SNOOZE_KEY)).toBe(String(now + INSTALL_SNOOZE_MS));
    expect(isInstallPromptSnoozed(now + 1)).toBe(true);
    expect(isInstallPromptSnoozed(now + INSTALL_SNOOZE_MS - 1)).toBe(true);
    expect(isInstallPromptSnoozed(now + INSTALL_SNOOZE_MS)).toBe(false);
  });

  it("treats a corrupt value as not snoozed", () => {
    vi.stubGlobal("localStorage", fakeStorage);
    store.set(INSTALL_SNOOZE_KEY, "garbage");
    expect(isInstallPromptSnoozed()).toBe(false);
  });

  it("survives storage being unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => snoozeInstallPrompt()).not.toThrow();
    expect(isInstallPromptSnoozed()).toBe(false);
  });
});
