import { CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, CircleSlash, Clock } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../../components/common/Button';
import { cn } from '../../utils/cn';

/* Small presentational pieces shared by the admin pages. */

export const formatCount = (value) => (Number.isInteger(value) ? value.toLocaleString() : '—');

/** "1 visit", "3 visits". `plural` is the plural noun; the singular drops its final "s". */
export const countOf = (value, plural) => `${formatCount(value)} ${value === 1 ? plural.replace(/s$/, '') : plural}`;

/** A labelled number. `period` states which time span the number covers. */
export function StatCard({ label, value, period, help, className }) {
  return (
    <div className={cn('rounded-xl border border-line bg-white p-4 sm:p-5', className)}>
      <dt className="text-sm font-medium text-slate-700">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold text-slate-900 tabular-nums">{formatCount(value)}</dd>
      {period && <dd className="mt-1 text-xs font-medium text-slate-600">{period}</dd>}
      {help && <dd className="mt-1 text-xs text-slate-600">{help}</dd>}
    </div>
  );
}

const BADGES = {
  active: { label: 'Active', icon: CheckCircle2, className: 'border-brand-200 bg-brand-50 text-brand-900' },
  inactive: { label: 'Deactivated', icon: CircleSlash, className: 'border-slate-300 bg-slate-100 text-slate-800' },
  in_progress: { label: 'In progress', icon: Clock, className: 'border-sky-300 bg-sky-50 text-sky-900' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'border-brand-200 bg-brand-50 text-brand-900' },
  not_completed: { label: 'Not completed', icon: CircleDashed, className: 'border-slate-300 bg-slate-100 text-slate-800' },
};

/** Text-and-icon badge for account and visit statuses (meaning never relies on colour alone). */
export function Badge({ kind, className }) {
  const badge = BADGES[kind];
  if (!badge) return null;
  const Icon = badge.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap', badge.className, className)}>
      <Icon aria-hidden="true" className="size-4" />
      {badge.label}
    </span>
  );
}

export const accountBadge = (isActive) => <Badge kind={isActive ? 'active' : 'inactive'} />;

export function SectionHeading({ id, title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-xl font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-700">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Definition list of label/value pairs; empty values show a dash. */
export function DetailList({ items, className }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.filter(Boolean).map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-sm text-slate-600">{label}</dt>
          <dd className="mt-0.5 font-medium break-words text-slate-900">{value === null || value === undefined || value === '' ? '—' : value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const textLink = 'font-semibold text-brand-800 underline underline-offset-4 hover:text-brand-900';

export function RecordLink({ to, children, srSuffix }) {
  return (
    <Link to={to} className={cn('inline-flex min-h-11 items-center', textLink)}>
      {children}
      {srSuffix && <span className="sr-only"> {srSuffix}</span>}
    </Link>
  );
}

/** Reads the 1-based `page` search parameter. */
export function usePageParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = Number(searchParams.get('page'));
  const page = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const setPage = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete('page');
    else params.set('page', String(next));
    setSearchParams(params);
  };
  return [page, setPage];
}

/** "Showing 21–40 of 57" with previous/next buttons. */
export function Pagination({ meta, onPage, label = 'results' }) {
  if (!meta || meta.total === 0) return null;
  const first = (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);
  const pages = Math.max(1, Math.ceil(meta.total / meta.limit));
  return (
    <nav aria-label={`Pages of ${label}`} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-700" aria-live="polite">
        Showing {first.toLocaleString()}–{last.toLocaleString()} of {meta.total.toLocaleString()} {label}
      </p>
      {pages > 1 && (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onPage(meta.page - 1)} disabled={meta.page <= 1}>
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </Button>
          <Button variant="secondary" onClick={() => onPage(meta.page + 1)} disabled={meta.page >= pages}>
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}
    </nav>
  );
}

/** Updates one search parameter and resets paging (used by list filters). */
export function useFilterParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value === undefined || value === null || value === '') params.delete(key);
    else params.set(key, String(value));
    params.delete('page');
    setSearchParams(params);
  };
  return [searchParams, setFilter];
}

/**
 * Wraps a list that keeps showing its previous results while new ones load (filters, paging):
 * the old results are dimmed and a status message says they are being updated.
 */
export function RefreshingRegion({ refreshing, children }) {
  return (
    <div aria-busy={refreshing || undefined} className="space-y-2">
      {refreshing && (
        <p role="status" className="text-sm font-medium text-slate-700">Updating results…</p>
      )}
      <div className={refreshing ? 'opacity-60 transition-opacity' : undefined}>{children}</div>
    </div>
  );
}
