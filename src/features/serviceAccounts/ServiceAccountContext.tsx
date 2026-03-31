import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const SERVICE_TOKEN_KEY = "bravo_service_token";

interface ServiceAccountContextType {
  /** True if a service account session is active */
  isServiceAccount: boolean;
  /** Whether the session is still being validated */
  isLoading: boolean;
  /** Name of the service account */
  accountName: string | null;
  /** Description of the service account */
  accountDescription: string | null;
  /** Module IDs this service account can access */
  allowedModules: string[];
  /** Log out the service account session */
  logout: () => Promise<void>;
}

const ServiceAccountContext = createContext<ServiceAccountContextType>({
  isServiceAccount: false,
  isLoading: true,
  accountName: null,
  accountDescription: null,
  allowedModules: [],
  logout: async () => {},
});

export function useServiceAccount() {
  return useContext(ServiceAccountContext);
}

export function ServiceAccountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(SERVICE_TOKEN_KEY)
  );

  // Only query if we have a token
  const session = useQuery(
    api.serviceAccounts.getServiceSession,
    token ? { token } : "skip"
  );

  const logoutMutation = useMutation(api.serviceAccounts.logoutServiceAccount);

  // If the session came back invalid, clear the token
  useEffect(() => {
    if (session && !session.valid && token) {
      localStorage.removeItem(SERVICE_TOKEN_KEY);
      setToken(null);
    }
  }, [session, token]);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await logoutMutation({ token });
      } catch {
        // Best-effort logout
      }
      localStorage.removeItem(SERVICE_TOKEN_KEY);
      setToken(null);
    }
  }, [token, logoutMutation]);

  const isLoading = token !== null && session === undefined;
  const isValid = session !== undefined && session.valid === true;

  const value: ServiceAccountContextType = {
    isServiceAccount: isValid,
    isLoading,
    accountName: isValid ? session.accountName : null,
    accountDescription: isValid ? (session.accountDescription ?? null) : null,
    allowedModules: isValid ? session.allowedModules : [],
    logout,
  };

  return (
    <ServiceAccountContext.Provider value={value}>
      {children}
    </ServiceAccountContext.Provider>
  );
}

/**
 * Helper: store a service account token after successful PIN login.
 */
export function storeServiceToken(token: string, redirectTo = "/") {
  localStorage.setItem(SERVICE_TOKEN_KEY, token);
  // Force a page reload so the provider picks it up
  window.location.href = redirectTo;
}

/**
 * Helper: check if there's a stored service token (synchronous check).
 */
export function hasServiceToken(): boolean {
  return localStorage.getItem(SERVICE_TOKEN_KEY) !== null;
}
