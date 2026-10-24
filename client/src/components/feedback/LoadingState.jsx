import { Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

/** Announces loading politely to screen readers and shows a visible text label. */
export function LoadingState({ label, className }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center justify-center gap-3 py-10 text-slate-700', className)}
    >
      <Loader2 aria-hidden="true" className="size-6 animate-spin text-brand-700" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}
