import { ChevronDown } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { useTranslation } from '../../hooks/useTranslation';
import { ACTIVE_STATUSES, TERMINAL_STATUSES } from './queueStatus';

function StatusGroup({ title, statuses }) {
  const { t } = useTranslation();
  return (
    <div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-3">
        {statuses.map((status) => (
          <li key={status} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
            <StatusBadge status={status} className="shrink-0 self-start" />
            <p className="text-sm text-slate-700">{t(`status.${status}.description`)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Expandable explanation of every queue status, grouped into active and finished. */
export function StatusLegend() {
  const { t } = useTranslation();
  return (
    <details className="group rounded-xl border border-line bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-3 font-semibold text-slate-900 hover:bg-canvas-muted [&::-webkit-details-marker]:hidden">
        {t('status.legendTitle')}
        <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-6 border-t border-line px-5 py-5 md:grid-cols-2">
        <StatusGroup title={t('status.activeGroup')} statuses={ACTIVE_STATUSES} />
        <StatusGroup title={t('status.finishedGroup')} statuses={TERMINAL_STATUSES} />
      </div>
    </details>
  );
}
