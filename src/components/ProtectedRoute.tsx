import React from 'react';
import { useQuery } from 'convex/react';
import { Navigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { AccessDenied } from './AccessDenied';

interface ProtectedRouteProps {
  children: React.ReactNode;
  moduleId: string;
  /**
   * Where to send users who fail the gate, instead of showing Access Denied.
   * Set this on routes a user can land on without choosing to: the PWA's
   * start_url is /availability, and that is burned into every copy already
   * installed on a phone, so non-operational members open the app straight
   * into a module they cannot see. A redirect is the honest answer there:
   * they didn't ask for this page, so denying it tells them nothing useful.
   */
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  moduleId,
  fallbackPath,
}: ProtectedRouteProps) {
  // Use the batched query shared across all ProtectedRoute instances
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);

  // Show loading state while checking permissions
  if (moduleAccess === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  // Look up access for this specific module
  const hasAccess = moduleAccess[moduleId as keyof typeof moduleAccess] ?? false;

  if (!hasAccess) {
    // `replace` keeps the denied path out of history, so Back doesn't bounce
    // them between the dashboard and a page they can't reach.
    return fallbackPath
      ? <Navigate to={fallbackPath} replace />
      : <AccessDenied moduleId={moduleId} />;
  }

  // Render the protected content
  return <>{children}</>;
}
