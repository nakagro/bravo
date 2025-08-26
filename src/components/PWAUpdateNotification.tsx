import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function PWAUpdateNotification() {
  const { needRefresh } = usePWAUpdate();

  useEffect(() => {
    if (needRefresh) {
      toast.info('App is updating to the latest version...', {
        duration: 2000,
      });
    }
  }, [needRefresh]);

  return null; // This component only handles notifications
}
