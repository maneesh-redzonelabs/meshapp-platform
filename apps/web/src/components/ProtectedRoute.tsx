import React from 'react';
import { Navigate } from 'react-router-dom';
import type { UserType } from '@meshapp/shared';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from './ui/Primitives';

export function ProtectedRoute({ allow, children }: { allow: UserType[]; children: React.ReactNode }) {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState label="Loading your session…" />
      </div>
    );
  }
  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }
  if (!allow.includes(user.user_type)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
