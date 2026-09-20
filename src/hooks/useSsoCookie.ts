import { useAuthToken } from "@convex-dev/auth/react";
import { useEffect } from "react";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function useSsoCookie() {
  const token = useAuthToken();
  useEffect(() => {
    const attrs = "domain=.grayhux.io; path=/; secure; samesite=lax";
    document.cookie = token
      ? `bravo_jwt=${token}; ${attrs}; max-age=${MAX_AGE_SECONDS}`
      : `bravo_jwt=; ${attrs}; max-age=0`;
  }, [token]);
}
