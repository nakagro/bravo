import { useEffect } from "react";
import { usePushRegister } from "../lib/pushNotifications";

export function PushNotifier() {
  const registerForPush = usePushRegister();

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      // Notifications API not supported (e.g., older iOS Safari). Skip registration.
      return;
    }

    if (Notification.permission === "granted") {
      registerForPush();
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          registerForPush();
        }
      });
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
