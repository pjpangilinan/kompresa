import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

type Props = {
  children: ReactNode;
};

export function ProtectedRoute({ children }: Props) {
  const { state, authenticated } = useAuth();
  const location = useLocation();

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" aria-busy="true">
        <div className="font-label-mono text-label-mono text-primary-container uppercase animate-pulse">
          INITIALIZING...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

export function PublicOnly({ children }: Props) {
  const { state, authenticated } = useAuth();

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" aria-busy="true">
        <div className="font-label-mono text-label-mono text-primary-container uppercase animate-pulse">
          INITIALIZING...
        </div>
      </div>
    );
  }

  if (authenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
