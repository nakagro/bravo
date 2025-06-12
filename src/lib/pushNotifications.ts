import { api } from "../../convex/_generated/api";
import { useMutation } from "convex/react";

// Helper to convert the base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushRegister() {
  const registerMutation = useMutation(api.pushNotifications.register);

  return async function registerForPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY as string
        ),
      });

      await registerMutation({ subscription: sub.toJSON() });
    } catch (err) {
      // Ignore if user denies permission or already subscribed
      console.error("Push registration error", err);
    }
  };
}
