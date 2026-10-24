import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

const TONES = {
  info: { icon: Info, classes: 'border-sky-200 bg-sky-50 text-sky-950', iconClass: 'text-sky-700' },
  success: {
    icon: CheckCircle2,
    classes: 'border-brand-200 bg-brand-50 text-brand-900',
    iconClass: 'text-brand-700',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'border-amber-200 bg-amber-50 text-amber-950',
    iconClass: 'text-amber-700',
  },
  error: { icon: XCircle, classes: 'border-red-200 bg-red-50 text-red-950', iconClass: 'text-red-700' },
};

/**
 * Bordered message box with an icon and text, so meaning never relies on colour alone.
 * `role` controls how assistive technology announces it (`alert` for errors, `status` for updates).
 */
export function Notice({ tone = 'info', title, children, action, role, className }) {
  const { icon: Icon, classes, iconClass } = TONES[tone];

  return (
    <div role={role} className={cn('flex gap-3 rounded-lg border p-4', classes, className)}>
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', iconClass)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1', 'text-sm leading-relaxed')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
