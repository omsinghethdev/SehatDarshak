import { useEffect, useState } from 'react';
import { Container } from '../components/common/Container';
import { SuccessMessage } from '../components/feedback/SuccessMessage';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PatientDashboard } from '../features/patient/PatientDashboard';
import { StaffHome } from '../features/staff/StaffHome';

const AUTH_EVENT_MESSAGES = {
  signedIn: { title: 'You are signed in', body: 'Welcome back.' },
  registered: { title: 'Your patient account has been created', body: 'You are now signed in.' },
};

/** Landing page after sign-in: the patient dashboard, or the staff/admin home. */
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
        <StaffHome user={user} role={role} isMockAuth={isMockAuth} />
      )}
    </Container>
  );
}
