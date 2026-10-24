import { Link } from 'react-router';
import { BrandLink } from './BrandLink';
import { Container } from '../common/Container';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';

const PUBLIC_LINKS = [
  { to: PATHS.home, label: 'Home' },
  { to: PATHS.login, label: 'Sign in' },
  { to: PATHS.register, label: 'Register' },
];

const SIGNED_IN_LINKS = [
  { to: PATHS.home, label: 'Home' },
  { to: PATHS.dashboard, label: 'Dashboard' },
  { to: PATHS.departments, label: 'Departments' },
  { to: PATHS.navigation, label: 'Hospital map' },
];

export function Footer() {
  const { isAuthenticated } = useAuth();
  const links = isAuthenticated ? SIGNED_IN_LINKS : PUBLIC_LINKS;

  return (
    <footer className="border-t border-line bg-canvas-muted">
      <Container className="grid gap-8 py-10 md:grid-cols-[2fr_1fr]">
        <div>
          <BrandLink />
          <p className="mt-3 max-w-xl text-sm text-slate-700">
            Queue tokens, clear directions, and a simple way to ask hospital staff for help during
            OPD visits.
          </p>
          <p className="mt-4 max-w-xl text-sm text-slate-700">
            Waiting times shown in SehatDarsak are simulated estimates. Assistance requests are for
            non-emergency help and are not an emergency medical service. For emergencies, contact
            hospital staff directly or use the hospital&apos;s designated emergency process.
          </p>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-sm font-semibold text-slate-900">Quick links</h2>
          <ul className="mt-2 space-y-1">
            {links.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="inline-flex min-h-11 min-w-11 items-center text-slate-700 underline-offset-4 hover:text-brand-800 hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>

      <div className="border-t border-line">
        <Container className="py-4 text-sm text-slate-600">
          © {new Date().getFullYear()} SehatDarsak. Demonstration project using fictional data.
        </Container>
      </div>
    </footer>
  );
}
