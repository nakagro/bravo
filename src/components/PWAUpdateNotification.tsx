import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

// How long the user has to click "Update now" before we reload automatically.
const UPDATE_GRACE_PERIOD_MS = 15_000;

export function PWAUpdateNotification() {
  const { needRefresh, updateServiceWorker } = usePWAUpdate();
  const hasPromptedRef = useRef(false);

  useEffect(() => {
    if (!needRefresh || hasPromptedRef.current) return;
    hasPromptedRef.current = true;

    const toastId = toast.info('A new version of BRAVO is available.', {
      description: 'The app will refresh automatically in a moment.',
      duration: UPDATE_GRACE_PERIOD_MS,
      action: {
        label: 'Update now',
        onClick: () => {
          void updateServiceWorker();
        },
      },
      onAutoClose: () => {
        void updateServiceWorker();
      },
    });

    return () => {
      toast.dismiss(toastId);
    };
  }, [needRefresh, updateServiceWorker]);

  return null; // This component only handles notifications
}
