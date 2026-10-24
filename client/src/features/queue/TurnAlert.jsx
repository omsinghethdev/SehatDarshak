import { AlertTriangle, BellRing, Hourglass, X } from 'lucide-react';
import { ListenButton } from '../../components/common/ListenButton';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

function alertContent(alert, departmentName, t) {
  const place = departmentName ?? t('queue.yourDepartment');
  if (alert.kind === 'status') {
    return {
      announceOnly: true,
      title: t('alerts.statusUpdated', { status: t(`status.${alert.status}.label`) }),
      body: t(`status.${alert.status}.description`),
    };
  }
  if (alert.kind === 'called') {
    return {
      icon: BellRing,
      title: t('alerts.called.title'),
      body: t('alerts.called.body', { department: place }),
      classes: 'border-amber-400 bg-amber-50 text-amber-950',
      iconClass: 'text-amber-700',
    };
  }
  if (alert.kind === 'skipped') {
    return {
      icon: AlertTriangle,
      title: t('alerts.skipped.title'),
      body: t('alerts.skipped.body'),
      classes: 'border-red-300 bg-red-50 text-red-950',
      iconClass: 'text-red-700',
    };
  }
  return {
    icon: Hourglass,
    title: t('alerts.approaching.title'),
    body: `${t('alerts.approaching.ahead', { count: alert.ahead })} ${t('alerts.approaching.stayNear')}`,
    classes: 'border-sky-300 bg-sky-50 text-sky-950',
    iconClass: 'text-sky-700',
  };
}

/**
 * Visible alert plus a screen-reader announcement. The live regions are always in the DOM (so
 * new text is reliably announced) and contain only the message — not the buttons.
 * "Called"/"skipped" are urgent (assertive); "approaching" is polite. "Listen" reads it aloud
 * only when pressed.
 */
export function TurnAlert({ alert, departmentName, onDismiss }) {
  const { t } = useTranslation();
  const content = alert ? alertContent(alert, departmentName, t) : null;
  const urgent = alert && (alert.kind === 'called' || alert.kind === 'skipped');
  const announcement = content ? `${content.title}. ${content.body}` : '';

  return (
    <>
      <p aria-live="assertive" className="sr-only">
        {urgent ? announcement : ''}
      </p>
      <p aria-live="polite" className="sr-only">
        {urgent ? '' : announcement}
      </p>
      {content && !content.announceOnly && (
        <div key={alert.key} className={cn('flex gap-3 rounded-xl border-2 p-4 sm:p-5', content.classes)}>
          <content.icon aria-hidden="true" className={cn('mt-0.5 size-6 shrink-0', content.iconClass)} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{content.title}</p>
            <p className="mt-1">{content.body}</p>
            <ListenButton text={announcement} className="mt-3" />
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-black/5"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">{t('alerts.dismiss')}</span>
          </button>
        </div>
      )}
    </>
  );
}
