import { Smartphone, X } from "lucide-react";
import { useState } from "react";
import {
  dismissInstallNudge,
  isInstallNudgeDismissed,
  isPhoneBrowserTab,
  openInstallPrompt,
  resolveInstallPlatform,
} from "@/lib/installState";

/**
 * Passive card above the sign-in form on phone browser tabs. Installing before
 * signing in matters most on iPhone, where the installed app has separate
 * storage: sign up in Safari first and you sign in twice.
 */
export function InstallNudgeCard() {
  const [platform] = useState(() => resolveInstallPlatform());
  const [dismissed, setDismissed] = useState(() => isInstallNudgeDismissed());

  if (dismissed || !isPhoneBrowserTab(platform)) return null;

  const onDismiss = () => {
    dismissInstallNudge();
    setDismissed(true);
  };

  return (
    <div
      role="note"
      className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900/50 dark:bg-red-900/20"
    >
      <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
      <div className="min-w-0 flex-1 text-gray-800 dark:text-gray-200">
        <p className="font-medium">BRAVO works best installed on your phone.</p>
        <p className="mt-0.5 text-gray-700 dark:text-gray-300">
          {platform.startsWith("ios")
            ? "Install it first and you will only need to sign in once. Notifications on iPhone and iPad only work from the installed app."
            : "Install it first for notifications and one-tap access from your home screen."}
        </p>
        <button
          type="button"
          onClick={openInstallPrompt}
          className="mt-2 font-medium text-red-700 underline-offset-2 hover:underline dark:text-red-400"
        >
          Show me how
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded p-1 text-gray-500 hover:bg-red-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-red-900/40"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
