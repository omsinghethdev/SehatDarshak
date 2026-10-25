import {
  Activity,
  BarChart3,
  Building2,
  ClipboardList,
  HandHelping,
  ListOrdered,
  Stethoscope,
  Users,
} from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router';
import { Container } from '../../components/common/Container';
import { Notice } from '../../components/feedback/Notice';
import { PATHS } from '../../routes/paths';
import { cn } from '../../utils/cn';
import { IS_MOCK_ADMIN } from './adminService';

// Admin sections. Queue operations and assistance requests reuse the existing staff/admin tools.
const SECTIONS = [
  { to: PATHS.admin, label: 'Overview', icon: BarChart3, exact: true },
  { to: PATHS.adminDoctors, label: 'Doctors', icon: Stethoscope },
  { to: PATHS.adminStaff, label: 'Staff', icon: Users },
  { to: PATHS.adminVisits, label: 'Patients & visits', icon: ClipboardList, also: ['/admin/patients'] },
  { to: PATHS.adminDepartments, label: 'Departments & wards', icon: Building2, also: ['/admin/wards'] },
  { to: PATHS.staffQueue, label: 'Queue operations', icon: ListOrdered },
  { to: PATHS.staffAssistance, label: 'Assistance requests', icon: HandHelping },
  { to: PATHS.adminActivity, label: 'Activity & audit', icon: Activity },
];

function isCurrent(section, pathname) {
  if (section.exact) return pathname === section.to;
  return [section.to, ...(section.also ?? [])].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Section navigation for every /admin page (route access is enforced by ProtectedRoute). */
export function AdminLayout() {
  const { pathname } = useLocation();

  return (
    <Container className="py-8 sm:py-10 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-8">
      <nav aria-label="Administration" className="mb-6 lg:mb-0">
        <p className="mb-2 hidden text-sm font-semibold tracking-wide text-brand-700 uppercase lg:block">Administration</p>
        <ul className="flex flex-wrap gap-2 lg:sticky lg:top-24 lg:flex-col lg:gap-1">
          {SECTIONS.map((section) => {
            const current = isCurrent(section, pathname);
            const Icon = section.icon;
            return (
              <li key={section.to}>
                <Link
                  to={section.to}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium whitespace-nowrap lg:border-transparent lg:text-base',
                    current
                      ? 'border-brand-700 bg-brand-50 text-brand-900 lg:border-brand-700'
                      : 'border-line bg-white text-slate-700 hover:bg-canvas-muted hover:text-slate-900 lg:bg-transparent',
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 space-y-6">
        {IS_MOCK_ADMIN && (
          <Notice tone="warning" title="Demo administration data">
            Figures are calculated in this browser from fictional demo queues and requests. The staff
            directory, wards, and activity log are a demo store: accounts here cannot sign in, and
            changes do not affect the demo sign-in accounts.
          </Notice>
        )}
        <Outlet />
      </div>
    </Container>
  );
}
