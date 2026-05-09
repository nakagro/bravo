import { useEffect, useState } from "react";

export const BA_RECORD_DELETE_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_REFRESH_MS = 30 * 1000;

export function isWithinBARecordDeleteWindow(createdAt: number, now = Date.now()) {
  return now - createdAt <= BA_RECORD_DELETE_WINDOW_MS;
}

export function useBARecordDeleteWindowNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), DELETE_WINDOW_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}
