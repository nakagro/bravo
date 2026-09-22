import { useAuthToken } from "@convex-dev/auth/react";
import { useEffect } from "react";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Write (or clear) the `bravo_jwt` cookie Labs reads. Shared by the main app
 * and `/sso-refresh.html` so the attributes can't drift apart: Labs clears
 * this cookie on sign-out, and a delete only works if `secure`/`samesite`
 * match what was set.
 */
export function writeSsoCookie(token: string | null) {
  const attrs = "domain=.grayhux.io; path=/; secure; samesite=lax";
  document.cookie = token
    ? `bravo_jwt=${token}; ${attrs}; max-age=${MAX_AGE_SECONDS}`
    : `bravo_jwt=; ${attrs}; max-age=0`;
}

export function useSsoCookie() {
  const token = useAuthToken();
  useEffect(() => {
    writeSsoCookie(token);
  }, [token]);
}
