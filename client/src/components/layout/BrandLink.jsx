import { HeartPulse } from 'lucide-react';
import { Link } from 'react-router';
import { PATHS } from '../../routes/paths';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

export function BrandLink({ className, onClick }) {
  const { t } = useTranslation();
  return (
    <Link
      to={PATHS.home}
      onClick={onClick}
      aria-label={t('layout.brandHome')}
      className={cn('inline-flex min-h-11 items-center gap-2.5 font-bold text-slate-900', className)}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-700">
        <HeartPulse aria-hidden="true" className="size-5 text-white" />
      </span>
      <span className="text-xl tracking-tight">Sehat Darshak</span>
    </Link>
  );
}
