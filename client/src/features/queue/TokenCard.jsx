import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '../../components/common/Button';
import { tokenStatusPath } from '../../routes/paths';
import { cn } from '../../utils/cn';
import { StatusBadge } from './StatusBadge';
import { TokenMetrics } from './TokenMetrics';
import { isActiveStatus } from './queueStatus';

/** Summary card for one queue token. */
export function TokenCard({ token, department, showStatusLink = true, className }) {
  const headingId = `token-${token.id}-heading`;
  const active = isActiveStatus(token.status);

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col rounded-xl border bg-white p-5 sm:p-6',
        active ? 'border-line' : 'border-dashed border-slate-300 bg-canvas-muted',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{department?.name ?? 'Department'}</p>
          <h3 id={headingId} className="mt-1">
            <span className="sr-only">Token </span>
            <span className="text-3xl font-bold tracking-tight text-slate-900">{token.displayNumber}</span>
          </h3>
        </div>
        <StatusBadge status={token.status} />
      </div>

      <TokenMetrics token={token} className="mt-5 border-t border-line pt-5" />

      {showStatusLink && (
        <div className="mt-6">
          <ButtonLink to={tokenStatusPath(token.id)} variant="secondary" className="w-full sm:w-auto">
            View queue status
            <span className="sr-only"> for token {token.displayNumber}</span>
            <ArrowRight aria-hidden="true" className="size-4" />
          </ButtonLink>
        </div>
      )}
    </article>
  );
}
