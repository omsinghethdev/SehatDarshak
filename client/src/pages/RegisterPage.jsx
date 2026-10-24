import { UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { DemoAuthNotice } from '../features/auth/DemoAuthNotice';
import { RegisterForm } from '../features/auth/RegisterForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PATHS } from '../routes/paths';

export function RegisterPage() {
  useDocumentTitle('Register');

  return (
    <StatusPageLayout icon={UserPlus} title="Register as a patient">
      <p>
        Create a patient account to get queue tokens and track your visit. You will be signed in
        straight away.
      </p>
      <DemoAuthNotice />
      <RegisterForm />
      <p className="border-t border-line pt-6 text-sm">
        Already have an account?{' '}
        <Link to={PATHS.login} className="inline-flex min-h-11 min-w-11 items-center font-semibold text-brand-800 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </StatusPageLayout>
  );
}
