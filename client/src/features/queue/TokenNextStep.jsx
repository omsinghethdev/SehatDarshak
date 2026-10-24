import { ArrowLeft, BellRing, CheckCircle2, Clock, HandHelping, SkipForward, Stethoscope, Ticket, XCircle } from 'lucide-react';
import { ButtonLink } from '../../components/common/Button';
import { ListenButton } from '../../components/common/ListenButton';
import { useTranslation } from '../../hooks/useTranslation';
import { PATHS, assistancePath, bookTokenPath } from '../../routes/paths';
import { cn } from '../../utils/cn';

function Panel({ icon: Icon, title, tone, children, actions, speech }) {
  const tones = {
    urgent: 'border-amber-400 bg-amber-50 text-amber-950',
    problem: 'border-red-300 bg-red-50 text-red-950',
    calm: 'border-line bg-white text-slate-900',
  };
  return (
    <section aria-labelledby="next-step-heading" className={cn('rounded-xl border-2 p-5', tones[tone])}>
      <h2 id="next-step-heading" className="flex items-center gap-2 text-lg font-bold">
        <Icon aria-hidden="true" className="size-6 shrink-0" />
        {title}
      </h2>
      <div className="mt-2 space-y-2">{children}</div>
      {(actions || speech) && (
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {actions}
          {speech && <ListenButton text={speech} />}
        </div>
      )}
    </section>
  );
}

/**
 * What the patient should do next for the token's current status — one clear action each.
 * Uses only the existing statuses; there is no recall/requeue endpoint, so a skipped token can
 * only be resolved by hospital staff (or by booking a new token).
 */
export function TokenNextStep({ token, departmentName }) {
  const { t, tx } = useTranslation();
  const place = departmentName ?? t('queue.yourDepartment');
  const strong = (value) => <strong>{value}</strong>;

  switch (token.status) {
    case 'waiting':
      return (
        <Panel
          icon={Clock}
          tone="calm"
          title={t('nextStep.waiting.title')}
          speech={() => `${t('nextStep.waiting.title')}. ${t('nextStep.waiting.body')}`}
        >
          <p>{t('nextStep.waiting.body')}</p>
        </Panel>
      );
    case 'called':
      return (
        <Panel
          icon={BellRing}
          tone="urgent"
          title={t('nextStep.called.title')}
          speech={() => `${t('nextStep.called.title')}. ${t('nextStep.called.body', { department: place, number: token.displayNumber })}`}
        >
          <p>{tx('nextStep.called.body', { department: strong(place), number: strong(token.displayNumber) })}</p>
        </Panel>
      );
    case 'in_consultation':
      return (
        <Panel icon={Stethoscope} tone="calm" title={t('nextStep.inConsultation.title')}>
          <p>{t('nextStep.inConsultation.body')}</p>
        </Panel>
      );
    case 'skipped':
      return (
        <Panel
          icon={SkipForward}
          tone="problem"
          title={t('nextStep.skipped.title')}
          speech={() => `${t('nextStep.skipped.title')}. ${t('nextStep.skipped.why')} ${t('nextStep.skipped.next', { department: place })}`}
          actions={
            <>
              <ButtonLink to={assistancePath(token.departmentId)}>
                <HandHelping aria-hidden="true" className="size-5" />
                {t('nextStep.skipped.contactStaff')}
              </ButtonLink>
              <ButtonLink to={bookTokenPath(token.departmentId)} variant="secondary">
                <Ticket aria-hidden="true" className="size-5" />
                {t('nextStep.bookNew')}
              </ButtonLink>
            </>
          }
        >
          <p>{t('nextStep.skipped.why')}</p>
          <p>
            <strong>{t('nextStep.nextStepLabel')}</strong> {t('nextStep.skipped.next', { department: place })}
          </p>
        </Panel>
      );
    case 'completed':
      return (
        <Panel
          icon={CheckCircle2}
          tone="calm"
          title={t('nextStep.completed.title')}
          actions={
            <ButtonLink to={PATHS.dashboard} variant="secondary">
              <ArrowLeft aria-hidden="true" className="size-5" />
              {t('common.backToDashboard')}
            </ButtonLink>
          }
        >
          <p>{t('nextStep.completed.body')}</p>
        </Panel>
      );
    case 'cancelled':
      return (
        <Panel
          icon={XCircle}
          tone="calm"
          title={t('nextStep.cancelled.title')}
          actions={
            <>
              <ButtonLink to={bookTokenPath(token.departmentId)}>
                <Ticket aria-hidden="true" className="size-5" />
                {t('nextStep.bookNew')}
              </ButtonLink>
              <ButtonLink to={assistancePath(token.departmentId)} variant="secondary">
                <HandHelping aria-hidden="true" className="size-5" />
                {t('nextStep.cancelled.askWhy')}
              </ButtonLink>
            </>
          }
        >
          <p>{t('nextStep.cancelled.body')}</p>
        </Panel>
      );
    default:
      return null;
  }
}
