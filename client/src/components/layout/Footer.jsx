import { Link } from 'react-router';
import { BrandLink } from './BrandLink';
import { Container } from '../common/Container';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { PATHS } from '../../routes/paths';

const PUBLIC_LINKS = [
  { to: PATHS.home, labelKey: 'nav.home' },
  { to: PATHS.login, labelKey: 'layout.signIn' },
  { to: PATHS.register, labelKey: 'layout.register' },
];

const SIGNED_IN_LINKS = [
  { to: PATHS.home, labelKey: 'nav.home' },
  { to: PATHS.dashboard, labelKey: 'nav.dashboard' },
  { to: PATHS.departments, labelKey: 'nav.departments' },
  { to: PATHS.navigation, labelKey: 'nav.map' },
];

export function Footer() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const links = isAuthenticated ? SIGNED_IN_LINKS : PUBLIC_LINKS;

  return (
    <footer className="border-t border-line bg-canvas-muted">
      <Container className="grid gap-8 py-10 md:grid-cols-[2fr_1fr]">
        <div>
          <BrandLink />
          <p className="mt-3 max-w-xl text-sm text-slate-700">{t('footer.about')}</p>
          <p className="mt-4 max-w-xl text-sm text-slate-700">{t('footer.safety')}</p>
        </div>

        <nav aria-label={t('footer.navLabel')}>
          <h2 className="text-sm font-semibold text-slate-900">{t('footer.quickLinks')}</h2>
          <ul className="mt-2 space-y-1">
            {links.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="inline-flex min-h-11 min-w-11 items-center text-slate-700 underline-offset-4 hover:text-brand-800 hover:underline"
                >
                  {t(link.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>

      <div className="border-t border-line">
        <Container className="py-4 text-sm text-slate-600">
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </Container>
      </div>
    </footer>
  );
}
