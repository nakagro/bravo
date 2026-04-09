import { useEffect, useRef } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth, useConvexConnectionState } from "convex/react";
import {
  formatDuration,
  getJwtMetadata,
  isConvexDebugEnabled,
  readStoredAuthState,
} from "@/lib/debug/convexDebug";

const _t = (label: string) => (window as any).__BRAVO_T?.(label);

function logDebug(message: string, data?: unknown) {
  const elapsed =
    typeof (window as any).__BRAVO_START === "number"
      ? Math.round(performance.now() - (window as any).__BRAVO_START)
      : 0;

  if (data === undefined) {
    console.log(`[BRAVO +${elapsed}ms] ${message}`);
    return;
  }

  console.log(`[BRAVO +${elapsed}ms] ${message}`, data);
}

function formatIsoTime(ms: number | null | undefined) {
  return typeof ms === "number" ? new Date(ms).toISOString() : null;
}

export function ConvexDebugObserver() {
  const enabled = isConvexDebugEnabled();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const connectionState = useConvexConnectionState();
  const authToken = useAuthToken();
  const lastSnapshot = useRef<string | null>(null);
  const didLogStartupState = useRef(false);

  useEffect(() => {
    if (!enabled || didLogStartupState.current) {
      return;
    }

    didLogStartupState.current = true;
    const storedState = readStoredAuthState(
      import.meta.env.VITE_CONVEX_URL as string,
    );
    logDebug("Convex debug enabled");
    logDebug("Stored auth state", {
      hasJwt: storedState.hasJwt,
      hasRefreshToken: storedState.hasRefreshToken,
      jwtRemaining: formatDuration(storedState.jwtMetadata?.remainingMs ?? null),
      jwtExpiresAt: formatIsoTime(storedState.jwtMetadata?.expiresAtMs),
      storageKeys: storedState.keys,
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const tokenMetadata = authToken ? getJwtMetadata(authToken) : null;
    const jwtRemainingMs = tokenMetadata?.remainingMs ?? null;
    const snapshot = JSON.stringify({
      isLoading,
      isAuthenticated,
      hasToken: authToken !== null,
      jwtRemainingBucket:
        jwtRemainingMs === null ? null : Math.round(jwtRemainingMs / 1000),
      isWebSocketConnected: connectionState.isWebSocketConnected,
      hasEverConnected: connectionState.hasEverConnected,
      connectionCount: connectionState.connectionCount,
      connectionRetries: connectionState.connectionRetries,
      hasInflightRequests: connectionState.hasInflightRequests,
      inflightMutations: connectionState.inflightMutations,
      inflightActions: connectionState.inflightActions,
    });

    if (snapshot === lastSnapshot.current) {
      return;
    }
    lastSnapshot.current = snapshot;

    logDebug("Auth/connection snapshot", {
      auth: {
        isLoading,
        isAuthenticated,
        hasToken: authToken !== null,
        jwtRemaining: formatDuration(jwtRemainingMs),
        jwtExpiresAt: formatIsoTime(tokenMetadata?.expiresAtMs),
      },
      connection: {
        isWebSocketConnected: connectionState.isWebSocketConnected,
        hasEverConnected: connectionState.hasEverConnected,
        connectionCount: connectionState.connectionCount,
        connectionRetries: connectionState.connectionRetries,
        hasInflightRequests: connectionState.hasInflightRequests,
        inflightMutations: connectionState.inflightMutations,
        inflightActions: connectionState.inflightActions,
      },
    });

    if (connectionState.isWebSocketConnected) {
      _t("Convex WebSocket connected");
    }
  }, [
    authToken,
    connectionState.connectionCount,
    connectionState.connectionRetries,
    connectionState.hasEverConnected,
    connectionState.hasInflightRequests,
    connectionState.inflightActions,
    connectionState.inflightMutations,
    connectionState.isWebSocketConnected,
    enabled,
    isAuthenticated,
    isLoading,
  ]);

  return null;
}
