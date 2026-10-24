import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { PATHS } from './paths';

/**
 * Layout route that requires a signed-in user, optionally restricted to `allowedRoles`.
 * Signed-out users go to /login (and return afterwards); users with another role go to
 * /unauthorized.
 *
 * This only controls what the UI shows. The server must still authorize every request.
 *
 * @example <Route element={<ProtectedRoute allowedRoles={['staff', 'admin']} />}>…</Route>
 */
export function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={PATHS.login} replace state={{ from: location }} />;
  }
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={PATHS.unauthorized} replace />;
  }
  return <Outlet />;
}
