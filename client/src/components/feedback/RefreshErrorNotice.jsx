import { Button } from '../common/Button';
import { useTranslation } from '../../hooks/useTranslation';
import { getErrorContent } from '../../utils/errorMessages';
import { Notice } from './Notice';

/**
 * Non-blocking warning for a failed background refresh: the last loaded data stays on screen
 * below it. Shown once per failure streak (it stays mounted until a refresh succeeds), so screen
 * readers hear it once rather than on every attempt; successful refreshes are never announced.
 */
export function RefreshErrorNotice({ error, onRetry, retrying, className }) {
  const { t, language } = useTranslation();
  if (!error) return null;

  return (
    <Notice
      tone="warning"
      role="alert"
      title={t('autoRefresh.failedTitle')}
      className={className}
      action={
        <Button variant="secondary" onClick={onRetry} aria-disabled={retrying || undefined}>
          {retrying ? t('common.loading') : t('common.tryAgain')}
        </Button>
      }
    >
      {getErrorContent(error, t, language.code).description} {t('autoRefresh.failedBody')}
    </Notice>
  );
}
