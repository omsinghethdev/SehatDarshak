import { ShieldAlert } from 'lucide-react';
import { ButtonLink } from '../components/common/Button';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PATHS } from '../routes/paths';

export function UnauthorizedPage() {
  useDocumentTitle('Access not allowed');
  const { isAuthenticated } = useAuth();

  return (
    <StatusPageLayout
      icon={ShieldAlert}
      eyebrow="Access not allowed"
      title="You can't view this page"
      actions={
        <>
          <ButtonLink to={PATHS.home}>Back to home</ButtonLink>
          {!isAuthenticated && (
            <ButtonLink to={PATHS.login} variant="secondary">
              Sign in
            </ButtonLink>
          )}
        </>
      }
    >
      <p>
        {isAuthenticated
          ? 'Your account does not have permission to open this page. If you think this is a mistake, ask hospital staff for help.'
          : 'You need to sign in with an account that has access to this page.'}
      </p>
    </StatusPageLayout>
  );
}
