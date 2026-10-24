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
  return [
    { to: PATHS.dashboard, label: 'Dashboard' },
    ...(role === 'patient' ? [{ to: PATHS.bookToken, label: 'Book a token' }] : []),
    { to: PATHS.departments, label: 'Departments' },
    { to: PATHS.navigation, label: 'Hospital map' },
    ...(role === 'patient' ? [{ to: PATHS.assistance, label: 'Get help' }] : []),
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
          const current = `${pathname}${hash}` === item.to;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center rounded-lg px-3 font-medium text-slate-700 hover:bg-canvas-muted hover:text-slate-900',
                  current && 'text-brand-800 underline decoration-2 underline-offset-8',
                  vertical ? 'px-4 text-lg' : 'whitespace-nowrap',
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
