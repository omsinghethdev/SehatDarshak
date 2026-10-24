import { MapPinOff } from 'lucide-react';
import { ButtonLink } from '../components/common/Button';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS } from '../routes/paths';

export function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('notFound.documentTitle'));

  return (
    <StatusPageLayout
      icon={MapPinOff}
      eyebrow={t('notFound.eyebrow')}
      title={t('notFound.title')}
      actions={<ButtonLink to={PATHS.home}>{t('common.backHome')}</ButtonLink>}
    >
      <p>{t('notFound.body')}</p>
    </StatusPageLayout>
  );
}
