import { Clock, Users } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { estimateLabel, formatEstimate, getWaitEstimate, isReliableCount } from './waitEstimate';

function EstimateTag({ children }) {
  return (
    <dd className="mt-0.5 inline-block rounded border border-line bg-canvas-muted px-1.5 text-xs font-medium text-slate-700">
      {children}
    </dd>
  );
}

/**
 * Patients-ahead and estimated-wait figures for a waiting token. Other statuses show their
 * plain-language description instead, since queue position no longer applies.
 * Missing or invalid values are shown as "Not available" rather than guessed
 * (see waitEstimate.js for how the estimate is chosen).
 */
export function TokenMetrics({ token, size = 'md', showBasis = false, showStatusDescription = true, className }) {
  const { t } = useTranslation();
  if (token.status !== 'waiting') {
    // Pages with their own next-step guidance (the token page) turn this off to avoid repeating it.
    if (!showStatusDescription) return null;
    return (
      <p className={cn('font-medium text-slate-800', size === 'lg' && 'text-lg', className)}>
        {t(`status.${token.status}.description`)}
      </p>
    );
  }

  const estimate = getWaitEstimate(token);
  const valueClass = cn('mt-1 font-semibold whitespace-nowrap text-slate-900', size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-2xl');
  const unavailableClass = 'mt-1 text-base font-medium text-slate-700';

  return (
    // Flex-wrap rather than a fixed grid: on very narrow screens the wait moves below the
    // patients-ahead figure instead of breaking mid-value.
    <dl className={cn('flex flex-wrap gap-x-10 gap-y-4', className)}>
      <div>
        <dt className="flex items-center gap-1.5 text-sm text-slate-600">
          <Users aria-hidden="true" className="size-4" />
          {t('queue.patientsAhead')}
        </dt>
        {isReliableCount(token.patientsAhead) ? (
          <dd className={valueClass}>{token.patientsAhead}</dd>
        ) : (
          <dd className={unavailableClass}>{t('common.notAvailable')}</dd>
        )}
      </div>
      <div>
        <dt className="flex items-center gap-1.5 text-sm text-slate-600">
          <Clock aria-hidden="true" className="size-4" />
          {t('queue.estimatedWait')}
        </dt>
        {estimate.kind === 'unavailable' ? (
          <dd className={unavailableClass}>{t('queue.estimateUnavailable')}</dd>
        ) : (
          <>
            <dd className={valueClass}>{formatEstimate(estimate.minutes, t)}</dd>
            <EstimateTag>{estimateLabel(estimate, t)}</EstimateTag>
            {showBasis && estimate.kind === 'calculated' && (
              <dd className="mt-1 text-xs text-slate-600">
                {t('estimate.basis', { count: estimate.patientsAhead, minutes: estimate.averageMinutes })}
              </dd>
            )}
          </>
        )}
      </div>
    </dl>
  );
}
