import { BarChart3, HandHelping, ListOrdered, Map as MapIcon, QrCode } from 'lucide-react';
import { QuickActionCard } from '../../components/common/QuickActionCard';
import { Notice } from '../../components/feedback/Notice';
import { PATHS } from '../../routes/paths';

const ROLE_LABELS = { staff: 'Hospital staff', admin: 'Administrator' };

/** /dashboard for staff and admin: account summary and shortcuts to their tools. */
export function StaffHome({ user, role, isMockAuth }) {
  const actions = [
    ...(role === 'admin'
      ? [{ to: PATHS.admin, icon: BarChart3, title: 'Operations overview', description: 'Queue and request counts across departments.' }]
      : []),
    { to: PATHS.staffQueue, icon: ListOrdered, title: 'Queue management', description: 'Call the next patient and update consultation status.' },
    { to: PATHS.staffAssistance, icon: HandHelping, title: 'Assistance requests', description: 'Review and acknowledge patient requests.' },
    { to: PATHS.scan, icon: QrCode, title: 'Scan a hospital QR code', description: 'Check a hospital QR code and open the place or queue it points to.' },
    { to: PATHS.navigation, icon: MapIcon, title: 'Hospital map', description: 'Find departments and facilities on each floor.' },
  ];

  return (
    <div className="space-y-8">
      {isMockAuth && (
        <Notice tone="warning" title="Simulated demo account">
          You are signed in with a development-only demo account. Everything you manage here is
          fictional demo data stored in this browser.
        </Notice>
      )}

      <section aria-labelledby="account-heading" className="rounded-xl border border-line bg-white p-6">
        <h2 id="account-heading" className="text-lg font-semibold text-slate-900">
          Your account
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-600">Name</dt>
            <dd className="font-medium text-slate-900">{user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Account type</dt>
            <dd className="font-medium text-slate-900">{ROLE_LABELS[role] ?? role}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="text-xl font-bold text-slate-900">
          Your tools
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {actions.map((action) => (
            <li key={action.to}>
              <QuickActionCard {...action} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
