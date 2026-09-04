import { useCallback, useEffect, useState } from "react";
import {
  detectInstallPlatform,
  isInstallPromptSnoozed,
  OPEN_INSTALL_PROMPT_EVENT,
  readInstallEnv,
  snoozeInstallPrompt,
  type InstallPlatform,
} from "@/lib/installState";

/** Chromium's beforeinstallprompt event. Not in lib.dom, so declared here. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallPromptState {
  platform: InstallPlatform;
  /** True once Chromium has handed us a prompt we can trigger. */
  canPromptNatively: boolean;
  /** The one-off prompt should be visible now. */
  shouldShow: boolean;
  /** Trigger the native install dialog (Android Chromium only). */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  /** "Not now": hide and snooze for a week. */
  dismiss: () => void;
  /** Open the prompt on demand, ignoring the snooze (used from Settings). */
  open: () => void;
}

// Chromium fires beforeinstallprompt very early, often before React has
// mounted, so it is captured at module level rather than inside the hook.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    promptListeners.forEach((fn) => fn());
  });
}

export function useInstallPrompt(): InstallPromptState {
  const [platform, setPlatform] = useState<InstallPlatform>(() =>
    detectInstallPlatform(readInstallEnv()),
  );
  const [canPromptNatively, setCanPromptNatively] = useState(deferredPrompt !== null);
  const [visible, setVisible] = useState(false);

  // Re-check after mount: display-mode can only be read once the window
  // exists, and appinstalled flips us to "installed" without a reload.
  useEffect(() => {
    const sync = () => {
      setPlatform(detectInstallPlatform(readInstallEnv()));
      setCanPromptNatively(deferredPrompt !== null);
    };
    sync();
    promptListeners.add(sync);
    return () => void promptListeners.delete(sync);
  }, []);

  // Decide whether the one-off prompt appears. Delayed so it never lands on
  // first paint; on Android it also waits for the browser to offer a prompt,
  // which Chromium only does after the user has interacted with the page.
  useEffect(() => {
    if (platform === "installed" || platform === "unsupported") return;
    if (isInstallPromptSnoozed()) return;
    if (platform === "android-native" && !canPromptNatively) return;
    const id = window.setTimeout(() => setVisible(true), 1500);
    return () => window.clearTimeout(id);
  }, [platform, canPromptNatively]);

  // Settings can reopen the sheet regardless of snooze.
  useEffect(() => {
    const onOpen = () => setVisible(true);
    window.addEventListener(OPEN_INSTALL_PROMPT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_INSTALL_PROMPT_EVENT, onOpen);
  }, []);

  const promptInstall = useCallback(async () => {
    const evt = deferredPrompt;
    if (!evt) return "unavailable" as const;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    // The event is single-use; Chromium will fire a fresh one later if declined.
    deferredPrompt = null;
    setCanPromptNatively(false);
    if (outcome === "accepted") setVisible(false);
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    snoozeInstallPrompt();
    setVisible(false);
  }, []);

  const open = useCallback(() => setVisible(true), []);

  return {
    platform,
    canPromptNatively,
    shouldShow: visible && platform !== "installed",
    promptInstall,
    dismiss,
    open,
  };
}
