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

// Detect device information from user agent
function getDeviceInfo() {
  const ua = navigator.userAgent;
  
  // Detect device type
  let deviceType: "mobile" | "tablet" | "desktop" = "desktop";
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = "tablet";
  } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    deviceType = "mobile";
  }
  
  // Detect platform/OS
  let platform = "Unknown";
  if (/iPhone|iPad|iPod/.test(ua)) {
    platform = "iOS";
  } else if (/Android/.test(ua)) {
    platform = "Android";
  } else if (/Windows/.test(ua)) {
    platform = "Windows";
  } else if (/Mac/.test(ua)) {
    platform = "macOS";
  } else if (/Linux/.test(ua)) {
    platform = "Linux";
  }
  
  // Detect browser
  let browser = "Unknown";
  if (/Edg/.test(ua)) {
    browser = "Edge";
  } else if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
    browser = "Chrome";
  } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    browser = "Safari";
  } else if (/Firefox/.test(ua)) {
    browser = "Firefox";
  } else if (/Opera|OPR/.test(ua)) {
    browser = "Opera";
  }
  
  return {
    deviceType,
    platform,
    browser,
    userAgent: ua,
  };
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

      // Get device information
      const deviceInfo = getDeviceInfo();

      await registerMutation({ 
        subscription: sub.toJSON(),
        ...deviceInfo,
      });
    } catch (err) {
      // Ignore if user denies permission or already subscribed
      console.error("Push registration error", err);
    }
  };
}
