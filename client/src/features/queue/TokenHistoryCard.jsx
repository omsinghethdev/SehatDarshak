import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '../../components/common/Button';
import { useTranslation } from '../../hooks/useTranslation';
import { tokenStatusPath } from '../../routes/paths';
import { StatusBadge } from './StatusBadge';

function formatDateTime(value, locale) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

// Only times the service actually recorded are shown; a missing one is left out, never guessed.
const TIME_FIELDS = ['issuedAt', 'calledAt', 'completedAt'];

/**
 * One finished token in the patient's history. Styled like an inactive TokenCard, with no queue
 * position, estimate, QR code, or cancel control, so it never looks like a live token.
 * `departmentName` is undefined while departments load, and null if the department is unknown.
 */
export function TokenHistoryCard({ token, departmentName, ref }) {
  const { t, language } = useTranslation();
  const headingId = `history-${token.id}-heading`;
  const times = TIME_FIELDS.map((field) => ({ field, raw: token[field], text: formatDateTime(token[field], language.locale) })).filter(
    (time) => time.text,
  );

  return (
    <article
      ref={ref}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="rounded-xl border border-dashed border-slate-300 bg-canvas-muted p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">
            {departmentName === undefined ? t('queue.department') : departmentName ?? t('queue.departmentUnavailable')}
          </p>
          <h3 id={headingId} className="mt-1">
            <span className="sr-only">{t('queue.token')} </span>
            <span className="text-2xl font-bold tracking-tight text-slate-900">{token.displayNumber}</span>
          </h3>
        </div>
        <p>
          <span className="sr-only">{t('queue.statusLabel')} </span>
          <StatusBadge status={token.status} />
        </p>
      </div>

      {times.length > 0 && (
        <dl className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          {times.map(({ field, raw, text }) => (
            <div key={field}>
              <dt className="text-sm text-slate-600">{t(`queue.history.${field}`)}</dt>
              <dd className="font-medium text-slate-900">
                <time dateTime={raw}>{text}</time>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <ButtonLink to={tokenStatusPath(token.id)} variant="secondary" className="mt-5 w-full sm:w-auto">
        {t('queue.history.viewDetails')}
        <span className="sr-only"> — {t('queue.token')} {token.displayNumber}</span>
        <ArrowRight aria-hidden="true" className="size-4" />
      </ButtonLink>
    </article>
  );
}
