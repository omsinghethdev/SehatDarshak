import { LogIn } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { DemoAuthNotice } from '../features/auth/DemoAuthNotice';
import { LoginForm } from '../features/auth/LoginForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS } from '../routes/paths';

export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  useDocumentTitle(t('auth.signInTitle'));

  return (
    <StatusPageLayout icon={LogIn} title={t('auth.signInTitle')}>
      <p>{t('auth.signInIntro')}</p>
      <DemoAuthNotice />
      <LoginForm />
      <p className="border-t border-line pt-6 text-sm">
        {t('auth.newPatient')}{' '}
        <Link to={PATHS.registerPatient} state={location.state} className="inline-flex min-h-11 min-w-11 items-center font-semibold text-brand-800 underline underline-offset-4">
          {t('auth.createAnAccount')}
        </Link>
        <br />
        {t('auth.otherAccounts')}{' '}
        <Link to={PATHS.register} state={location.state} className="inline-flex min-h-11 min-w-11 items-center font-semibold text-brand-800 underline underline-offset-4">
          {t('auth.seeAccountTypes')}
        </Link>
      </p>
    </StatusPageLayout>
  );
}
