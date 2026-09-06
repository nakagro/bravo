import { useMutation } from "convex/react";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";
import { getDeviceId, resolveInstallPlatform, type InstallPlatform } from "@/lib/installState";

const SESSION_KEY = "bravo:launch-recorded";

export function launchFacts(platform: InstallPlatform) {
  const displayMode = platform === "installed" ? ("installed" as const) : ("browser" as const);
  // "installed" hides the OS, so lean on the UA for the device class there.
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isPhoneUa = /Android|iPhone|iPad|iPod/.test(ua) || (/Mac/.test(ua) && (navigator?.maxTouchPoints ?? 0) > 2);
  const deviceClass =
    platform === "unsupported" || (platform === "installed" && !isPhoneUa)
      ? ("desktop" as const)
      : ("phone" as const);
  return { displayMode, deviceClass };
}

/**
 * Once per app session after sign-in: tell PostHog and Convex how BRAVO was
 * opened, so admins can see who is still on a phone browser tab. Mount inside
 * the authenticated shell only.
 */
export function LaunchTelemetry() {
  const posthog = usePostHog();
  const recordLaunch = useMutation(api.userLaunches.recordLaunch);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // No sessionStorage: record anyway, the server throttles repeats.
    }

    const platform = resolveInstallPlatform();
    const { displayMode, deviceClass } = launchFacts(platform);

    posthog?.capture("app_launched", {
      install_platform: platform,
      display_mode: displayMode,
      device_class: deviceClass,
    });
    posthog?.setPersonProperties({
      last_display_mode: displayMode,
      last_install_platform: platform,
    });

    void recordLaunch({ deviceId: getDeviceId(), platform, displayMode, deviceClass }).catch(
      () => {
        // Telemetry must never surface to the member.
      },
    );
  }, [posthog, recordLaunch]);

  return null;
}
