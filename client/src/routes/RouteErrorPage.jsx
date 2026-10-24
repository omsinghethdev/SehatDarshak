import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { buttonClasses } from '../components/common/Button';
import { NotFoundPage } from '../pages/NotFoundPage';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

/** Fallback for unexpected render errors so users never see a blank screen. */
export function RouteErrorPage() {
  const error = useRouteError();
  useDocumentTitle('Something went wrong');

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <StatusPageLayout
      icon={AlertTriangle}
      title="Something went wrong"
      actions={
        // Plain link so the app fully reloads from a clean state.
        <a href="/" className={buttonClasses()}>
          Reload home page
        </a>
      }
    >
      <p>The page could not be displayed. Please reload and try again.</p>
    </StatusPageLayout>
  );
}
