import { useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";
import { WifiOff } from "lucide-react";

// Grace period before showing the banner, so brief reconnects
// (e.g. waking the phone) don't flash it at the user.
const OFFLINE_GRACE_MS = 2500;

/**
 * Persistent banner shown while the Convex WebSocket is disconnected.
 * Critical for availability accuracy - members need to know when their
 * status changes aren't reaching the server.
 */
export function ConnectionBanner() {
  const { isWebSocketConnected } = useConvexConnectionState();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isWebSocketConnected) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), OFFLINE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [isWebSocketConnected]);

  if (!show) return null;

  return (
    <div
      role="alert"
      className="bg-amber-500 dark:bg-amber-600 text-amber-950 dark:text-amber-50 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium"
    >
      <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>Offline, changes won't be saved until you reconnect</span>
    </div>
  );
}
