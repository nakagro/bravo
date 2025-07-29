import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  moduleId: string;
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  moduleId, 
  fallbackPath = "/" 
}) => {
  const hasAccess = useQuery(api.modules.checkModuleAccess, { moduleId });

  // Show loading state while checking permissions
  if (hasAccess === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  // Redirect if no access
  if (hasAccess === false) {
    return <Navigate to={fallbackPath} replace />;
  }

  // Render the protected content
  return <>{children}</>;
};
