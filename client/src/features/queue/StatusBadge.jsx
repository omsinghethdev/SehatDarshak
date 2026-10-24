import { cn } from '../../utils/cn';
import { STATUS_DETAILS } from './queueStatus';

/** Status pill with icon and text label (never colour alone). */
export function StatusBadge({ status, className }) {
  const details = STATUS_DETAILS[status];
  if (!details) {
    return (
      <span className={cn('inline-flex rounded-full border border-slate-300 px-3 py-1 text-sm', className)}>
        Unknown status
      </span>
    );
  }
  const { icon: Icon, label, badgeClass } = details;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold',
        badgeClass,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </span>
  );
}
