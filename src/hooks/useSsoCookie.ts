import { useAuthToken } from "@convex-dev/auth/react";
import { useEffect } from "react";
import { SSO_DOMAIN } from "@/lib/brigadeConfig";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Write (or clear) the `bravo_jwt` cookie shared with companion apps under
 * `VITE_SSO_DOMAIN`. No-op when `VITE_SSO_DOMAIN` is unset.
 */
export function writeSsoCookie(token: string | null, domain = SSO_DOMAIN) {
  if (!domain) return;
  const attrs = `domain=.${domain}; path=/; secure; samesite=lax`;
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
