import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useRef } from 'react';

// Actively check for a new SW every 60s, plus whenever the tab regains focus.
// Tops up Workbox's own default (much less frequent) check cadence so a fresh
// deploy is noticed quickly instead of sitting undetected for a while.
const UPDATE_CHECK_INTERVAL_MS = 60_000;

export function usePWAUpdate() {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swScriptUrl, registration) {
      console.log('SW registered:', swScriptUrl);
      registrationRef.current = registration;
    },
    onRegisterError(error: unknown) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    const checkForUpdate = () => {
      void registrationRef.current?.update();
    };

    const intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

    const onFocus = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return {
    offlineReady,
    needRefresh,
    updateServiceWorker,
    close,
  };
}
