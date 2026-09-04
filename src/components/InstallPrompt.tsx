import { Compass, Download, Menu, PlusSquare, Share } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { getEnvironmentBadge } from "@/utils/environment";
import { readInstallEnv, usesSafari26Toolbar, type InstallPlatform } from "@/lib/installState";

const APP_ICON = "/icons/web-app-manifest-192x192.png";

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-700 text-xs font-semibold text-white">
        {n}
      </span>
      <span className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
        {icon}
        <span>{children}</span>
      </span>
    </li>
  );
}

const iconClass = "h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400";

function Instructions({ platform }: { platform: InstallPlatform }) {
  switch (platform) {
    case "ios-safari":
      // iOS 26 folded Safari's toolbar into one menu button; Share is inside it.
      if (usesSafari26Toolbar(readInstallEnv())) {
        return (
          <div className="space-y-3">
            <ol className="space-y-3">
              <Step n={1} icon={<Menu className={iconClass} />}>
                Tap the <strong>menu button</strong> (three lines) at the end of Safari's
                address bar.
              </Step>
              <Step n={2} icon={<Share className={iconClass} />}>
                Tap <strong>Share</strong>.
              </Step>
              <Step n={3} icon={<PlusSquare className={iconClass} />}>
                Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
              </Step>
            </ol>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              If you see a Share icon in the toolbar instead, tap that and skip step 1.
            </p>
          </div>
        );
      }
      return (
        <ol className="space-y-3">
          <Step n={1} icon={<Share className={iconClass} />}>
            Tap <strong>Share</strong> in Safari's toolbar.
          </Step>
          <Step n={2} icon={<PlusSquare className={iconClass} />}>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </Step>
          <Step n={3} icon={<Download className={iconClass} />}>
            Tap <strong>Add</strong>, then open BRAVO from your home screen.
          </Step>
        </ol>
      );
    case "ios-other":
      return (
        <ol className="space-y-3">
          <Step n={1} icon={<Compass className={iconClass} />}>
            Open this page in <strong>Safari</strong>. Other browsers on iPhone and iPad
            cannot install apps or receive notifications.
          </Step>
          <Step n={2} icon={<Share className={iconClass} />}>
            In Safari, tap <strong>Share</strong> then <strong>Add to Home Screen</strong>.
          </Step>
        </ol>
      );
    case "android-manual":
      return (
        <ol className="space-y-3">
          <Step n={1} icon={<Menu className={iconClass} />}>
            Open your browser's <strong>menu</strong>.
          </Step>
          <Step n={2} icon={<Download className={iconClass} />}>
            Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.
          </Step>
        </ol>
      );
    default:
      return null;
  }
}

interface InstallPromptProps {
  /** Open the sheet automatically after sign-in. Default true. */
  autoShow?: boolean;
  /**
   * The viewer already has a session. On iOS the installed app has its own
   * storage, so that session will not carry across and they must sign in
   * again; say so up front instead of letting it look broken.
   */
  signedIn?: boolean;
}

export function InstallPrompt({ autoShow = true, signedIn = false }: InstallPromptProps) {
  const { platform, canPromptNatively, shouldShow, promptInstall, dismiss } = useInstallPrompt({
    autoShow,
  });

  if (platform === "installed" || platform === "unsupported") return null;

  const envBadge = getEnvironmentBadge();
  const appName = envBadge ? `BRAVO ${envBadge.short}` : "BRAVO";
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      toast.success("BRAVO is installing. Open it from your home screen.");
    } else if (outcome === "unavailable") {
      toast.error("Your browser did not offer an install option. Try the browser menu instead.");
    }
  };

  return (
    <Drawer open={shouldShow} onOpenChange={(open) => !open && dismiss()}>
      <DrawerContent aria-describedby="install-prompt-description">
        <DrawerHeader className="text-left">
          <div className="flex items-center gap-3">
            <img src={APP_ICON} alt="" className="h-12 w-12 rounded-xl" />
            <div className="min-w-0">
              <DrawerTitle>Install {appName}</DrawerTitle>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{hostname}</p>
            </div>
          </div>
          <DrawerDescription id="install-prompt-description" className="pt-2">
            Add BRAVO to your home screen to get turnout and Duty Crew notifications.
            {platform.startsWith("ios") && (
              <> On iPhone and iPad, notifications only work from the installed app.</>
            )}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4">
          <Instructions platform={platform} />
          {signedIn && platform.startsWith("ios") && (
            <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              The installed app keeps its own sign-in. When you first open it from the home
              screen, sign in again with the same email and member number.
            </p>
          )}
        </div>

        <DrawerFooter>
          {platform === "android-native" && (
            <Button onClick={() => void handleInstall()} disabled={!canPromptNatively}>
              <Download className="mr-2 h-4 w-4" />
              Install
            </Button>
          )}
          <Button variant="outline" onClick={dismiss}>
            Not now
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
