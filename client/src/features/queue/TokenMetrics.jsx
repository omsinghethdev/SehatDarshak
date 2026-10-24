import { Clock, Users } from 'lucide-react';
import { cn } from '../../utils/cn';
import { STATUS_DETAILS, formatWaitMinutes } from './queueStatus';

const FALLBACK_ESTIMATE_LABEL = 'Simulated estimate';

/**
 * Patients-ahead and estimated-wait figures for a waiting token. Other statuses show their
 * plain-language description instead, since queue position no longer applies.
 */
export function TokenMetrics({ token, size = 'md', className }) {
  if (token.status !== 'waiting') {
    return (
      <p className={cn('font-medium text-slate-800', size === 'lg' && 'text-lg', className)}>
        {STATUS_DETAILS[token.status]?.description}
      </p>
    );
  }

  const valueClass = cn('mt-1 font-semibold text-slate-900', size === 'lg' ? 'text-3xl' : 'text-2xl');

  return (
    <dl className={cn('grid grid-cols-2 gap-4', className)}>
      <div>
        <dt className="flex items-center gap-1.5 text-sm text-slate-600">
          <Users aria-hidden="true" className="size-4" />
          Patients ahead
        </dt>
        <dd className={valueClass}>{token.patientsAhead}</dd>
      </div>
      <div>
        <dt className="flex items-center gap-1.5 text-sm text-slate-600">
          <Clock aria-hidden="true" className="size-4" />
          Estimated wait
        </dt>
        <dd className={valueClass}>{formatWaitMinutes(token.estimatedWaitMinutes)}</dd>
        <dd className="mt-0.5 inline-block rounded border border-line bg-canvas-muted px-1.5 text-xs font-medium text-slate-700">
          {token.estimateLabel || FALLBACK_ESTIMATE_LABEL}
        </dd>
      </div>
    </dl>
  );
}
