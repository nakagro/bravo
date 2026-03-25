import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { AccessDenied } from './AccessDenied';

interface ProtectedRouteProps {
  children: React.ReactNode;
  moduleId: string;
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  moduleId,
}) => {
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
    return <AccessDenied moduleId={moduleId} />;
  }

  // Render the protected content
  return <>{children}</>;
};
