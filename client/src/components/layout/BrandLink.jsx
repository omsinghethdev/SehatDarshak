import { Link } from 'react-router';
import { BrandMark } from '../common/BrandMark';
import { PATHS } from '../../routes/paths';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

/** `animateMark` draws the logo's pulse line once when this link first mounts. */
export function BrandLink({ className, onClick, animateMark = false }) {
  const { t } = useTranslation();
  return (
    <Link
      to={PATHS.home}
      onClick={onClick}
      aria-label={t('layout.brandHome')}
      className={cn('inline-flex min-h-11 items-center gap-2.5 font-bold text-slate-900', className)}
    >
      <BrandMark className="size-9" animated={animateMark} />
      <span className="text-xl tracking-tight whitespace-nowrap">Sehat Darshak</span>
    </Link>
  );
}
