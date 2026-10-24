import { LogIn } from 'lucide-react';
import { Link } from 'react-router';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { DemoAuthNotice } from '../features/auth/DemoAuthNotice';
import { LoginForm } from '../features/auth/LoginForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PATHS } from '../routes/paths';

export function LoginPage() {
  useDocumentTitle('Sign in');

  return (
    <StatusPageLayout icon={LogIn} title="Sign in">
      <p>Sign in with your username and password.</p>
      <DemoAuthNotice />
      <LoginForm />
      <p className="border-t border-line pt-6 text-sm">
        New patient?{' '}
        <Link to={PATHS.register} className="inline-flex min-h-11 min-w-11 items-center font-semibold text-brand-800 underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </StatusPageLayout>
  );
}
