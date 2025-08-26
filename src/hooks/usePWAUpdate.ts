import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect } from 'react';

export function usePWAUpdate() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error: unknown) {
      console.log('SW registration error', error);
    },
  });

  // Auto-update when new version is available
  useEffect(() => {
    if (needRefresh) {
      console.log('New PWA version available, updating...');
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

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
