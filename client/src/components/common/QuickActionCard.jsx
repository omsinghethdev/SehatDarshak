import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

/** Dashboard shortcut card. Without `to`, it renders as plain (non-link) information. */
export function QuickActionCard({ to, icon: Icon, title, description }) {
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-50">
        <Icon aria-hidden="true" className="size-6 text-brand-700" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-semibold text-slate-900">
          {title}
          {to && <ArrowRight aria-hidden="true" className="size-4" />}
        </span>
        <span className="mt-0.5 block text-sm text-slate-700">{description}</span>
      </span>
    </>
  );

  const base = 'flex h-full gap-4 rounded-xl border border-line bg-white p-5';
  return to ? (
    <Link to={to} className={`${base} hover:border-brand-600 hover:bg-brand-50/40`}>
      {body}
    </Link>
  ) : (
    <div className={`${base} bg-canvas-muted`}>{body}</div>
  );
}
