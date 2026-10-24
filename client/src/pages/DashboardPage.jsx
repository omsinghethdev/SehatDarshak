import { useEffect, useState } from 'react';
import { Container } from '../components/common/Container';
import { SuccessMessage } from '../components/feedback/SuccessMessage';
import { PageHeader } from '../components/layout/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { PatientDashboard } from '../features/patient/PatientDashboard';
import { StaffHome } from '../features/staff/StaffHome';

const AUTH_EVENT_KEYS = { signedIn: 'dashboard.signedIn', registered: 'dashboard.registered' };

/** Landing page after sign-in: the patient dashboard, or the staff/admin home. */
export function DashboardPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.dashboard'));
  const { user, role, isMockAuth, authEvent, dismissAuthEvent } = useAuth();

  // Show the sign-in confirmation once, then clear it so it does not reappear on return visits.
  const [confirmation] = useState(() => AUTH_EVENT_KEYS[authEvent] ?? null);
  useEffect(() => {
    dismissAuthEvent();
  }, [dismissAuthEvent]);

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      {confirmation && <SuccessMessage title={t(`${confirmation}.title`)}>{t(`${confirmation}.body`)}</SuccessMessage>}

      <PageHeader
        eyebrow={t('nav.dashboard')}
        title={t('dashboard.welcome', { name: user.name })}
        description={role === 'patient' ? t('dashboard.intro') : undefined}
      />

      {role === 'patient' ? (
        <PatientDashboard />
      ) : (
        <StaffHome user={user} role={role} isMockAuth={isMockAuth} />
      )}
    </Container>
  );
}
