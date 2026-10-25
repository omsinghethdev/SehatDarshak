import { useCallback } from 'react';
import { MapPinned, Navigation } from 'lucide-react';
import { Button, ButtonLink } from '../../components/common/Button';
import { Notice } from '../../components/feedback/Notice';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useTranslation } from '../../hooks/useTranslation';
import { directionsPath } from '../../routes/paths';
import { navigationService } from './navigationService';

/**
 * "Navigate to <department>" for a queue token. The destination comes from the token's own
 * departmentId (as returned by the service), resolved by the map service to that department's
 * mapped room; nothing is inferred from names shown on screen. The link carries the token ID so
 * the map can lead back to this token. If no room is mapped, it says so instead of guessing.
 */
export function NavigateToDepartment({ token, departmentName, className }) {
  const { t } = useTranslation();
  const departmentId = token.departmentId;
  const load = useCallback(
    (signal) => navigationService.getDepartmentDestination(departmentId, { signal }),
    [departmentId],
  );
  const { status, data, reload } = useAsyncData(load);
  const name = departmentName ?? t('queue.yourDepartment');

  if (status === 'error') {
    return (
      <Notice
        tone="warning"
        title={t('directions.fromToken.errorTitle')}
        className={className}
        action={
          <Button variant="secondary" onClick={reload}>
            {t('common.tryAgain')}
          </Button>
        }
      >
        {t('waiting.mapErrorBody')}
      </Notice>
    );
  }

  if (!data) {
    return <p className={`text-sm text-slate-600 ${className ?? ''}`}>{t('directions.fromToken.loading')}</p>;
  }

  if (!data.destination) {
    return (
      <Notice tone="info" title={t('directions.fromToken.unmappedTitle')} className={className}>
        {t('directions.fromToken.unmappedBody')}
      </Notice>
    );
  }

  const { destination } = data;
  return (
    <section aria-labelledby={`navigate-${token.id}-heading`} className={`rounded-xl border border-line bg-white p-5 ${className ?? ''}`}>
      <h2 id={`navigate-${token.id}-heading`} className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <MapPinned aria-hidden="true" className="size-5 text-brand-700" />
        {t('directions.fromToken.title')}
      </h2>
      <p className="mt-1 text-slate-700">{t('directions.fromToken.room', { place: destination.displayName, floor: destination.floorName })}</p>
      <ButtonLink to={directionsPath({ to: destination.id, token: token.id })} className="mt-4">
        <Navigation aria-hidden="true" className="size-5" />
        {t('directions.fromToken.navigate', { department: name })}
      </ButtonLink>
    </section>
  );
}
