import { Notice } from '../../components/feedback/Notice';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';

/** Shown on auth forms in mock mode so demo sign-in is never mistaken for the real service. */
export function DemoAuthNotice() {
  const { isMockAuth } = useAuth();
  const { t } = useTranslation();
  if (!isMockAuth) return null;

  return (
    <Notice tone="warning" title={t('demo.authTitle')}>
      {t('demo.authBody')}
    </Notice>
  );
}
