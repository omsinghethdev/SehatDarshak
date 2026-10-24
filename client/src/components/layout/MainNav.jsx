import { Link, useLocation } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { PATHS } from '../../routes/paths';
import { cn } from '../../utils/cn';

const PUBLIC_ITEMS = [
  { to: PATHS.home, labelKey: 'nav.home' },
  { to: `${PATHS.home}#features`, labelKey: 'nav.features' },
  { to: `${PATHS.home}#how-it-works`, labelKey: 'nav.howItWorks' },
];

function getSignedInItems(role) {
  if (role === 'patient') {
    return [
      { to: PATHS.dashboard, labelKey: 'nav.dashboard' },
      { to: PATHS.bookToken, labelKey: 'nav.bookToken' },
      { to: PATHS.departments, labelKey: 'nav.departments' },
      { to: PATHS.navigation, labelKey: 'nav.map' },
      { to: PATHS.assistance, labelKey: 'nav.getHelp' },
    ];
  }
  return [
    { to: PATHS.dashboard, labelKey: 'nav.dashboard' },
    ...(role === 'admin' ? [{ to: PATHS.admin, labelKey: 'nav.overview' }] : []),
    { to: PATHS.staffQueue, labelKey: 'nav.queue' },
    { to: PATHS.staffAssistance, labelKey: 'nav.requests' },
    { to: PATHS.navigation, labelKey: 'nav.map' },
  ];
}

/**
 * Primary site navigation. Renders horizontally on wide screens and as a
 * stacked list inside the mobile menu (`orientation="vertical"`).
 */
export function MainNav({ orientation = 'horizontal', onNavigate, id }) {
  const { pathname, hash } = useLocation();
  const { isAuthenticated, role } = useAuth();
  const { t } = useTranslation();
  const items = isAuthenticated ? getSignedInItems(role) : PUBLIC_ITEMS;
  const vertical = orientation === 'vertical';

  return (
    <nav id={id} aria-label={t('nav.mainLabel')}>
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
                  'flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-base leading-6 font-medium whitespace-nowrap text-slate-700 hover:bg-canvas-muted hover:text-slate-900',
                  // The underline is drawn inside the link's fixed-height box, so it never shifts layout.
                  current && 'text-brand-800 underline decoration-2 underline-offset-8',
                  vertical && 'justify-start px-4 text-lg leading-7 whitespace-normal',
                )}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
