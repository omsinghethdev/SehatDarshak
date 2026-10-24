import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { buttonClasses } from '../components/common/Button';
import { NotFoundPage } from '../pages/NotFoundPage';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';

/** Fallback for unexpected render errors so users never see a blank screen. */
export function RouteErrorPage() {
  const error = useRouteError();
  const { t } = useTranslation();
  useDocumentTitle(t('errors.FALLBACK.title'));

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <StatusPageLayout
      icon={AlertTriangle}
      title={t('errors.FALLBACK.title')}
      actions={
        // Plain link so the app fully reloads from a clean state.
        <a href="/" className={buttonClasses()}>
          {t('routeError.reload')}
        </a>
      }
    >
      <p>{t('routeError.body')}</p>
    </StatusPageLayout>
  );
}
