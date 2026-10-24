import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { ASSISTANCE_STATUS_DETAILS } from './assistanceRules';

/** Status pill with icon and text (never colour alone). Unknown values are shown, not guessed. */
export function AssistanceStatusBadge({ status, className }) {
  const { t } = useTranslation();
  const details = ASSISTANCE_STATUS_DETAILS[status];
  if (!details) {
    return (
      <span className={cn('inline-flex rounded-full border border-slate-300 px-3 py-1 text-sm', className)}>
        {t('assistance.status.unavailable')}
      </span>
    );
  }
  const { icon: Icon, badgeClass } = details;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold', badgeClass, className)}>
      <Icon aria-hidden="true" className="size-4" />
      {t(`assistance.status.${status}.label`, { defaultValue: details.label })}
    </span>
  );
}
