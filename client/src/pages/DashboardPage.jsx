import { useEffect, useState } from 'react';
import { Construction } from 'lucide-react';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { Notice } from '../components/feedback/Notice';
import { SuccessMessage } from '../components/feedback/SuccessMessage';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PatientDashboard } from '../features/patient/PatientDashboard';

const ROLE_LABELS = { patient: 'Patient', staff: 'Hospital staff', admin: 'Administrator' };

const AUTH_EVENT_MESSAGES = {
  signedIn: { title: 'You are signed in', body: 'Welcome back.' },
  registered: { title: 'Your patient account has been created', body: 'You are now signed in.' },
};

function OtherRoleDashboard({ user, role, isMockAuth }) {
  return (
    <>
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

      {isMockAuth && (
        <Notice tone="warning" title="Demo account">
          You are signed in with a development-only demo account stored in this browser. It is not
          connected to the hospital service.
        </Notice>
      )}

      <EmptyState
        icon={Construction}
        title="Staff and admin tools are on the way"
        description="Queue management and monitoring will appear here once they are available."
      />
    </>
  );
}

/** Landing page after sign-in: the patient dashboard, or a placeholder for other roles. */
export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user, role, isMockAuth, authEvent, dismissAuthEvent } = useAuth();

  // Show the sign-in confirmation once, then clear it so it does not reappear on return visits.
  const [confirmation] = useState(() => AUTH_EVENT_MESSAGES[authEvent] ?? null);
  useEffect(() => {
    dismissAuthEvent();
  }, [dismissAuthEvent]);

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      {confirmation && <SuccessMessage title={confirmation.title}>{confirmation.body}</SuccessMessage>}

      <div>
        <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Welcome, {user.name}</h1>
        {role === 'patient' && (
          <p className="mt-2 text-slate-700">Here is your OPD visit at a glance.</p>
        )}
      </div>

      {role === 'patient' ? (
        <PatientDashboard />
      ) : (
        <OtherRoleDashboard user={user} role={role} isMockAuth={isMockAuth} />
      )}
    </Container>
  );
}
