import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/user';
import { LoadingSpinner } from '../components/ui';

import { getDefaultDashboardRoute } from '../utils/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { currentUser, role, loading } = useAuth();
  const location = useLocation();

  // If loading or if user is authenticated but role is still resolving, show loader instead of flashing unauthorized
  if (loading || (currentUser && role === null)) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <LoadingSpinner size="lg" text="Verifying Royal College of Nursing Swat Authentication..." />
      </div>
    );
  }

  // Not logged in -> redirect to login
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role validation if specific roles are required
  if (allowedRoles && allowedRoles.length > 0) {
    // Admin has institutional oversight over teacher exam administration
    const isPermitted = role && (allowedRoles.includes(role) || (role === 'admin' && allowedRoles.includes('teacher')));
    if (!isPermitted) {
      // Seamlessly redirect to the user's appropriate authorized dashboard rather than showing 403
      const targetRoute = getDefaultDashboardRoute(role);
      return <Navigate to={targetRoute} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
