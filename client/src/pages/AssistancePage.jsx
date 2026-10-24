import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Inbox, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
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
import { ASSISTANCE_SAFETY_NOTICE } from '../features/assistance/assistanceRules';
import { useAssistanceHistory } from '../features/assistance/useAssistanceHistory';
import { departmentService } from '../features/departments/departmentService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

function SafetyNotice() {
  return (
    <Notice tone="warning" title="Non-emergency help only">
      {ASSISTANCE_SAFETY_NOTICE}
    </Notice>
  );
}

function SubmissionConfirmation({ request, department, onSendAnother }) {
  const headingRef = useRef(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="space-y-5">
      <SuccessMessage title="Your request has been submitted">
        It now has the status <strong>Open</strong> until a staff member acknowledges it. You can
        follow its status in “Your requests” below.
      </SuccessMessage>
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-slate-900">
        Request summary
      </h3>
      <dl className="grid gap-3 rounded-xl border border-line bg-white p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm text-slate-600">Status</dt>
          <dd className="mt-1">
            <AssistanceStatusBadge status={request.status} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Department</dt>
          <dd className="font-medium text-slate-900">{department?.name ?? 'Not available'}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Location</dt>
          <dd className="font-medium break-words text-slate-900">{request.location}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm text-slate-600">Message</dt>
          <dd className="font-medium break-words whitespace-pre-line text-slate-900">{request.message}</dd>
        </div>
      </dl>
      {request.notice && (
        <Notice tone="info" title="Notice from the service">
          {request.notice}
        </Notice>
      )}
      <SafetyNotice />
      <Button variant="secondary" onClick={onSendAnother}>
        <Plus aria-hidden="true" className="size-5" />
        Send another request
      </Button>
    </div>
  );
}

function RequestHistory({ history, departmentsById, onAnnounce }) {
  const { status, items, error, reload, hasMore, loadMore, loadingMore, moreError, replaceItem, meta } = history;

  let content;
  if (status === 'error') {
    content = <ErrorState error={error} onRetry={reload} />;
  } else if (status === 'loading' && items.length === 0) {
    content = <LoadingState label="Loading your requests…" />;
  } else if (items.length === 0) {
    content = (
      <EmptyState
        icon={Inbox}
        title="You have not sent any assistance requests"
        description="Requests you send will appear here with their status."
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
                  onAnnounce('Request status updated to Acknowledged.');
                }}
              />
            </li>
          ))}
        </ul>
        {moreError && <ErrorState error={moreError} onRetry={loadMore} />}
        {hasMore && (
          <Button variant="secondary" onClick={loadMore} aria-disabled={loadingMore || undefined}>
            {loadingMore ? 'Loading…' : 'Show older requests'}
          </Button>
        )}
        {meta?.total > 0 && (
          <p className="text-sm text-slate-600">
            Showing {items.length} of {meta.total}
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
            Your requests
          </h2>
          <p className="mt-1 text-sm text-slate-600">Newest first. Only you can see your requests.</p>
        </div>
        {status !== 'error' && (
          <Button variant="ghost" onClick={reload} aria-disabled={status === 'loading' || undefined}>
            <RefreshCw aria-hidden="true" className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </Button>
        )}
      </div>
      {content}
    </section>
  );
}

export function AssistancePage() {
  useDocumentTitle('Ask for assistance');
  const { isMockAuth } = useAuth();
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
    formContent = <LoadingState label="Loading the request form…" />;
  } else if (departments.data.length === 0) {
    formContent = (
      <EmptyState
        icon={Building2}
        title="Requests cannot be sent right now"
        description="No departments are available. Please speak to hospital staff in person."
        action={<Button variant="secondary" onClick={departments.reload}>Check again</Button>}
      />
    );
  } else {
    formContent = <AssistanceRequestForm departments={departments.data} onSubmitted={handleSubmitted} />;
  }

  return (
    <Container className="max-w-4xl space-y-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="Patient support"
        title="Ask for assistance"
        description="Ask hospital staff for non-emergency help, such as finding a department, mobility support, or a question about your visit."
      />

      {isMockAuth && (
        <Notice tone="warning" title="Demo mode">
          Requests are saved only in this browser and are not sent to hospital staff. Statuses change
          only when you use the clearly marked demo buttons.
        </Notice>
      )}

      <section aria-labelledby="request-form-heading" className="space-y-5 rounded-xl border border-line bg-white p-5 shadow-raised sm:p-8">
        <h2 id="request-form-heading" className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <ShieldAlert aria-hidden="true" className="size-5 text-brand-700" />
          New request
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
