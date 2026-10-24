import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Inbox, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { SuccessMessage } from '../components/feedback/SuccessMessage';
import { PageHeader } from '../components/layout/PageHeader';
import { AssistanceRequestCard } from '../features/assistance/AssistanceRequestCard';
import { AssistanceRequestForm } from '../features/assistance/AssistanceRequestForm';
import { AssistanceStatusBadge } from '../features/assistance/AssistanceStatusBadge';
import { useAssistanceHistory } from '../features/assistance/useAssistanceHistory';
import { departmentService } from '../features/departments/departmentService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { ListenButton } from '../components/common/ListenButton';

function SafetyNotice() {
  const { t } = useTranslation();
  return (
    <Notice tone="warning" title={t('assistance.safetyTitle')}>
      {t('assistance.safety')}
    </Notice>
  );
}

function SubmissionConfirmation({ request, department, onSendAnother }) {
  const headingRef = useRef(null);
  const { t, tx } = useTranslation();
  useEffect(() => headingRef.current?.focus(), []);
  const openLabel = t('assistance.status.open.label');

  return (
    <div className="space-y-5">
      <SuccessMessage
        title={t('assistance.submittedTitle')}
        action={<ListenButton text={() => `${t('assistance.submittedTitle')}. ${t('assistance.submittedBody', { status: openLabel })} ${t('assistance.safety')}`} />}
      >
        {tx('assistance.submittedBody', { status: <strong>{openLabel}</strong> })}
      </SuccessMessage>
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-slate-900">
        {t('assistance.summary')}
      </h3>
      <dl className="grid gap-3 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm text-slate-600">{t('queue.statusLabel')}</dt>
          <dd className="mt-1">
            <AssistanceStatusBadge status={request.status} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">{t('queue.department')}</dt>
          <dd className="font-medium text-slate-900">{department?.name ?? t('common.notAvailable')}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">{t('assistance.location')}</dt>
          <dd className="font-medium break-words text-slate-900">{request.location}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-slate-600">{t('assistance.message')}</dt>
          <dd className="font-medium break-words whitespace-pre-line text-slate-900">{request.message}</dd>
        </div>
      </dl>
      {request.notice && (
        <Notice tone="info" title={t('assistance.serviceNotice')}>
          {/* The service's own wording, shown as received. */}
          <span lang="en">{request.notice}</span>
        </Notice>
      )}
      <SafetyNotice />
      <Button variant="secondary" onClick={onSendAnother}>
        <Plus aria-hidden="true" className="size-5" />
        {t('assistance.sendAnother')}
      </Button>
    </div>
  );
}

function RequestHistory({ history, departmentsById, onAnnounce }) {
  const { t } = useTranslation();
  const { status, items, error, reload, hasMore, loadMore, loadingMore, moreError, replaceItem, meta } = history;

  let content;
  if (status === 'error') {
    content = <ErrorState error={error} onRetry={reload} />;
  } else if (status === 'loading' && items.length === 0) {
    content = <LoadingState label={t('assistance.loadingRequests')} />;
  } else if (items.length === 0) {
    content = (
      <EmptyState
        icon={Inbox}
        title={t('assistance.emptyTitle')}
        description={t('assistance.emptyBody')}
      />
    );
  } else {
    content = (
      <div className="space-y-4">
        <ul className="space-y-4">
          {items.map((request) => (
            <li key={request.id}>
              <AssistanceRequestCard
                request={request}
                departmentsById={departmentsById}
                onUpdated={(updated) => {
                  replaceItem(updated);
                  onAnnounce(t('assistance.statusUpdated', { status: t('assistance.status.acknowledged.label') }));
                }}
              />
            </li>
          ))}
        </ul>
        {moreError && <ErrorState error={moreError} onRetry={loadMore} />}
        {hasMore && (
          <Button variant="secondary" onClick={loadMore} aria-disabled={loadingMore || undefined}>
            {loadingMore ? t('common.loading') : t('assistance.showOlder')}
          </Button>
        )}
        {meta?.total > 0 && (
          <p className="text-sm text-slate-600">
            {t('assistance.showingCount', { shown: items.length, total: meta.total })}
          </p>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="history-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="history-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            {t('assistance.yourRequests')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{t('assistance.historyIntro')}</p>
        </div>
        {status !== 'error' && (
          <Button variant="ghost" onClick={reload} aria-disabled={status === 'loading' || undefined}>
            <RefreshCw aria-hidden="true" className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'} />
            {t('common.refresh')}
          </Button>
        )}
      </div>
      {content}
    </section>
  );
}

export function AssistancePage() {
  const { t } = useTranslation();
  useDocumentTitle(t('assistance.title'));
  const { isMockAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const loadDepartments = useCallback((signal) => departmentService.listDepartments({ signal }), []);
  const departments = useAsyncData(loadDepartments);
  const departmentsById = useMemo(
    () => (departments.data ? new Map(departments.data.map((item) => [item.id, item])) : null),
    [departments.data],
  );
  const history = useAssistanceHistory();
  const { reload: reloadHistory } = history;

  function handleSubmitted(request) {
    setSubmitted(request);
    reloadHistory();
  }

  let formContent;
  if (submitted) {
    formContent = (
      <SubmissionConfirmation
        request={submitted}
        department={departmentsById?.get(submitted.departmentId)}
        onSendAnother={() => setSubmitted(null)}
      />
    );
  } else if (departments.status === 'error') {
    formContent = <ErrorState error={departments.error} onRetry={departments.reload} />;
  } else if (!departments.data) {
    formContent = <LoadingState label={t('assistance.loadingForm')} />;
  } else if (departments.data.length === 0) {
    formContent = (
      <EmptyState
        icon={Building2}
        title={t('assistance.unavailableTitle')}
        description={t('assistance.unavailableBody')}
        action={<Button variant="secondary" onClick={departments.reload}>{t('common.checkAgain')}</Button>}
      />
    );
  } else {
    formContent = (
      <AssistanceRequestForm
        departments={departments.data}
        initialDepartmentId={searchParams.get('department')}
        onSubmitted={handleSubmitted}
      />
    );
  }

  return (
    <Container className="max-w-4xl space-y-8 py-10 sm:py-14">
      <PageHeader
        eyebrow={t('assistance.eyebrow')}
        title={t('assistance.title')}
        description={t('assistance.intro')}
      />

      {isMockAuth && (
        <Notice tone="warning" title={t('demo.modeTitle')}>
          {t('demo.assistanceBody')}
        </Notice>
      )}

      <section aria-labelledby="request-form-heading" className="space-y-5 rounded-xl border border-line bg-white p-5 shadow-raised sm:p-8">
        <h2 id="request-form-heading" className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <ShieldAlert aria-hidden="true" className="size-5 text-brand-700" />
          {t('assistance.newRequest')}
        </h2>
        {!submitted && <SafetyNotice />}
        {formContent}
      </section>

      <RequestHistory history={history} departmentsById={departmentsById} onAnnounce={setAnnouncement} />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </Container>
  );
}
