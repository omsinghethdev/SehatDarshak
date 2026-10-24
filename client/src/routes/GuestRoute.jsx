import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { getPostLoginPath } from './redirects';

/**
 * Layout route for sign-in and registration. Signed-in users are sent on to their
 * requested page or the dashboard; this is also how a successful sign-in redirects.
 */
export function GuestRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) return <Navigate to={getPostLoginPath(location.state)} replace />;
  return <Outlet />;
}
