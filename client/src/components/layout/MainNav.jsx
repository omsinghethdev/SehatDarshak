import { Link, useLocation } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';
import { cn } from '../../utils/cn';

const PUBLIC_ITEMS = [
  { to: PATHS.home, label: 'Home' },
  { to: `${PATHS.home}#features`, label: 'Features' },
  { to: `${PATHS.home}#how-it-works`, label: 'How it works' },
];

function getSignedInItems(role) {
  if (role === 'patient') {
    return [
      { to: PATHS.dashboard, label: 'Dashboard' },
      { to: PATHS.bookToken, label: 'Book a token' },
      { to: PATHS.departments, label: 'Departments' },
      { to: PATHS.navigation, label: 'Hospital map' },
      { to: PATHS.assistance, label: 'Get help' },
    ];
  }
  return [
    { to: PATHS.dashboard, label: 'Dashboard' },
    ...(role === 'admin' ? [{ to: PATHS.admin, label: 'Overview' }] : []),
    { to: PATHS.staffQueue, label: 'Queue' },
    { to: PATHS.staffAssistance, label: 'Requests' },
    { to: PATHS.navigation, label: 'Hospital map' },
  ];
}

/**
 * Primary site navigation. Renders horizontally on wide screens and as a
 * stacked list inside the mobile menu (`orientation="vertical"`).
 */
export function MainNav({ orientation = 'horizontal', onNavigate, id }) {
  const { pathname, hash } = useLocation();
  const { isAuthenticated, role } = useAuth();
  const items = isAuthenticated ? getSignedInItems(role) : PUBLIC_ITEMS;
  const vertical = orientation === 'vertical';

  return (
    <nav id={id} aria-label="Main">
      <ul className={cn('flex', vertical ? 'flex-col gap-1' : 'items-center gap-1')}>
        {items.map((item) => {
          const exactMatch = items.some((other) => other.to === `${pathname}${hash}`);
          const current = exactMatch ? item.to === `${pathname}${hash}` : item.to === pathname;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 font-medium text-slate-700 hover:bg-canvas-muted hover:text-slate-900',
                  current && 'text-brand-800 underline decoration-2 underline-offset-8',
                  vertical && 'justify-start px-4 text-lg',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
