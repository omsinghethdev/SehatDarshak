import { PATHS } from './paths';

const AUTH_PAGES = [PATHS.login, PATHS.register];
const isAuthPage = (pathname) => AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

/**
 * Where to send a user after signing in: the protected page they originally requested
 * (stored by ProtectedRoute in `location.state.from`), otherwise the dashboard.
 */
export function getPostLoginPath(locationState) {
  const from = locationState?.from;
  if (!from?.pathname?.startsWith('/') || from.pathname.startsWith('//')) return PATHS.dashboard;
  if (isAuthPage(from.pathname)) return PATHS.dashboard;
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}
