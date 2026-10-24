import { cn } from '../../utils/cn';

/**
 * Standard page heading: optional eyebrow label, the page's single <h1>, a short description,
 * and optional actions. Keeps title sizes and spacing identical across pages.
 */
export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">{eyebrow}</p>}
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-balance text-slate-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-slate-700">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
