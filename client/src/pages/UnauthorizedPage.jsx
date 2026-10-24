import { ShieldAlert } from 'lucide-react';
import { ButtonLink } from '../components/common/Button';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS } from '../routes/paths';

export function UnauthorizedPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('access.documentTitle'));
  const { isAuthenticated } = useAuth();

  return (
    <StatusPageLayout
      icon={ShieldAlert}
      eyebrow={t('access.documentTitle')}
      title={t('access.title')}
      actions={
        <>
          <ButtonLink to={PATHS.home}>{t('common.backHome')}</ButtonLink>
          {!isAuthenticated && (
            <ButtonLink to={PATHS.login} variant="secondary">
              {t('layout.signIn')}
            </ButtonLink>
          )}
        </>
      }
    >
      <p>{isAuthenticated ? t('access.signedInBody') : t('access.signedOutBody')}</p>
    </StatusPageLayout>
  );
}
