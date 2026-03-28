import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type ProtectedRouteProps = {
  children: React.ReactNode;
  allowedRoles?: string[];
};

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <p>Cargando…</p>
      </div>
    );
  }

  if (!user) {
    const from = location.pathname + location.search;
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess = user.rol === 'administrador' || allowedRoles.includes(user.rol);
    if (!hasAccess) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
