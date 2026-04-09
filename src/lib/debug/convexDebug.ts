const DEBUG_STORAGE_KEY = "bravo_debug_convex";

type JwtMetadata = {
  issuedAtMs: number | null;
  expiresAtMs: number | null;
  remainingMs: number | null;
};

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function syncConvexDebugFlagFromUrl(): boolean {
  const url = new URL(window.location.href);
  const flag = url.searchParams.get("debugConvex");

  if (flag === "1") {
    localStorage.setItem(DEBUG_STORAGE_KEY, "1");
  } else if (flag === "0") {
    localStorage.removeItem(DEBUG_STORAGE_KEY);
  }

  return localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
}

export function isConvexDebugEnabled(): boolean {
  return localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
}

export function getConvexAuthStorageKeys(convexUrl: string) {
  const namespace = convexUrl.replace(/[^a-zA-Z0-9]/g, "");
  return {
    jwt: `__convexAuthJWT_${namespace}`,
    refreshToken: `__convexAuthRefreshToken_${namespace}`,
  };
}

export function readStoredAuthState(convexUrl: string) {
  const keys = getConvexAuthStorageKeys(convexUrl);
  const jwt = localStorage.getItem(keys.jwt);
  const refreshToken = localStorage.getItem(keys.refreshToken);

  return {
    keys,
    hasJwt: jwt !== null,
    hasRefreshToken: refreshToken !== null,
    jwtMetadata: jwt ? getJwtMetadata(jwt) : null,
  };
}

export function getJwtMetadata(token: string): JwtMetadata | null {
  const payload = parseJwtPayload(token);
  if (!payload) {
    return null;
  }

  const issuedAt =
    typeof payload.iat === "number" ? payload.iat * 1000 : null;
  const expiresAt =
    typeof payload.exp === "number" ? payload.exp * 1000 : null;

  return {
    issuedAtMs: issuedAt,
    expiresAtMs: expiresAt,
    remainingMs: expiresAt === null ? null : expiresAt - Date.now(),
  };
}

export function formatDuration(ms: number | null): string {
  if (ms === null) {
    return "unknown";
  }

  const sign = ms < 0 ? "-" : "";
  const totalSeconds = Math.abs(Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${sign}${minutes}m ${seconds}s`;
}
