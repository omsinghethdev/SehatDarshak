import { UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { DemoAuthNotice } from '../features/auth/DemoAuthNotice';
import { RegisterForm } from '../features/auth/RegisterForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS } from '../routes/paths';

export function RegisterPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.registerTitle'));

  return (
    <StatusPageLayout icon={UserPlus} title={t('auth.registerTitle')}>
      <p>{t('auth.registerIntro')}</p>
      <DemoAuthNotice />
      <RegisterForm />
      <p className="border-t border-line pt-6 text-sm">
        {t('auth.haveAccount')}{' '}
        <Link to={PATHS.login} className="inline-flex min-h-11 min-w-11 items-center font-semibold text-brand-800 underline underline-offset-4">
          {t('layout.signIn')}
        </Link>
      </p>
    </StatusPageLayout>
  );
}
