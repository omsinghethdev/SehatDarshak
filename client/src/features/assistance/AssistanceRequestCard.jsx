import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/feedback/ErrorState';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { AssistanceStatusBadge } from './AssistanceStatusBadge';
import { ASSISTANCE_STATUS_DETAILS } from './assistanceRules';
import { assistanceDemoControls } from './assistanceService';

function formatDateTime(value, locale) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

function DemoAcknowledge({ request, onUpdated }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const { t } = useTranslation();
  if (!assistanceDemoControls || request.status !== 'open') return null;

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      onUpdated(await assistanceDemoControls.acknowledge(request.id));
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
      <p className="flex items-center gap-1.5 text-sm text-amber-950">
        <FlaskConical aria-hidden="true" className="size-4 text-amber-700" />
        {t('demo.assistanceNote')}
      </p>
      <Button variant="secondary" onClick={handleClick} aria-disabled={pending || undefined} className="mt-2">
        {pending ? t('common.updating') : t('demo.controls.simulate', { action: t('demo.controls.acknowledge') })}
      </Button>
      {error && <ErrorState error={error} className="mt-3" />}
    </div>
  );
}

/**
 * One assistance request. Patients see the mock-only demo control; staff pass their own
 * `actions` (e.g. an Acknowledge button) and `showDemoControls={false}`.
 */
export function AssistanceRequestCard({ request, departmentsById, onUpdated, actions, showDemoControls = true }) {
  const { t, language } = useTranslation();
  const notReturned = t('assistance.notReturned');
  const createdAt = formatDateTime(request.createdAt, language.locale);
  const department = request.departmentId ? departmentsById?.get(request.departmentId) : null;
  const departmentText = !request.departmentId ? notReturned : department?.name ?? t('queue.departmentUnavailable');
  const statusDetails = ASSISTANCE_STATUS_DETAILS[request.status];
  const statusLabel = statusDetails ? t(`assistance.status.${request.status}.label`) : t('assistance.status.unavailable');

  return (
    <article
      aria-label={t('assistance.cardLabel', { time: createdAt ?? t('assistance.timeUnavailable'), status: statusLabel })}
      className={cn(
        'rounded-xl border bg-white p-5',
        request.status === 'acknowledged' ? 'border-line' : 'border-amber-300',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AssistanceStatusBadge status={request.status} />
        <p className="text-sm text-slate-600">
          {createdAt ? (
            <>
              {t('assistance.sent')} <time dateTime={request.createdAt}>{createdAt}</time>
            </>
          ) : (
            t('assistance.timeUnavailable')
          )}
        </p>
      </div>
      {statusDetails && <p className="mt-2 text-sm text-slate-700">{t(`assistance.status.${request.status}.description`)}</p>}

      <dl className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm text-slate-600">{t('assistance.message')}</dt>
          <dd className="font-medium break-words whitespace-pre-line text-slate-900">{request.message || notReturned}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">{t('queue.department')}</dt>
          <dd className="font-medium text-slate-900">{departmentText}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">{t('assistance.location')}</dt>
          <dd className="font-medium break-words text-slate-900">{request.location || notReturned}</dd>
        </div>
      </dl>

      {actions && <div className="mt-4 border-t border-line pt-4">{actions}</div>}
      {showDemoControls && <DemoAcknowledge request={request} onUpdated={onUpdated} />}
    </article>
  );
}
