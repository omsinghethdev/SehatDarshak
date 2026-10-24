import { useCallback, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { SuccessMessage } from '../components/feedback/SuccessMessage';
import { PageHeader } from '../components/layout/PageHeader';
import { AssistanceRequestCard } from '../features/assistance/AssistanceRequestCard';
import { ASSISTANCE_SAFETY_NOTICE } from '../features/assistance/assistanceRules';
import { staffAssistanceService } from '../features/assistance/assistanceService';
import { departmentService } from '../features/departments/departmentService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useFocusWhenLost } from '../hooks/useFocusWhenLost';
import { usePagedList } from '../hooks/usePagedList';
import { cn } from '../utils/cn';

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: '', label: 'All' },
];

function AcknowledgeButton({ request, pending, onAcknowledge }) {
  if (request.status !== 'open') {
    return (
      <p className="flex items-center gap-1.5 text-sm text-slate-700">
        <CheckCircle2 aria-hidden="true" className="size-4 text-brand-700" />
        Already acknowledged — no further action in this system.
      </p>
    );
  }
  return (
    <Button onClick={() => onAcknowledge(request)} aria-disabled={pending || undefined}>
      <CheckCircle2 aria-hidden="true" className="size-5" />
      {pending ? 'Acknowledging…' : 'Acknowledge request'}
    </Button>
  );
}

export function StaffAssistancePage() {
  useDocumentTitle('Assistance requests');
  const { isMockAuth, role } = useAuth();
  const [statusFilter, setStatusFilter] = useState('open');
  const [pendingId, setPendingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadDepartments = useCallback((signal) => departmentService.listDepartments({ signal }), []);
  const departments = useAsyncData(loadDepartments);
  const departmentsById = useMemo(
    () => (departments.data ? new Map(departments.data.map((item) => [item.id, item])) : null),
    [departments.data],
  );

  const fetchPage = useCallback(
    (options) => staffAssistanceService.listRequests({ ...options, status: statusFilter || undefined }),
    [statusFilter],
  );
  const requests = usePagedList(fetchPage, 20);
  const { replaceItem, reload } = requests;
  const feedbackRef = useRef(null);
  const armFocusRestore = useFocusWhenLost(feedbackRef, requests.items);

  async function handleAcknowledge(request) {
    if (pendingId) return;
    setPendingId(request.id);
    setFeedback(null);
    armFocusRestore();
    try {
      const updated = await staffAssistanceService.acknowledge(request.id);
      if (statusFilter === 'open') reload();
      else replaceItem(updated);
      setFeedback({ tone: 'success', message: 'The request is now marked as acknowledged. The patient will see this status in their request list.' });
    } catch (error) {
      setFeedback({ tone: 'error', error });
      reload();
    } finally {
      setPendingId(null);
    }
  }

  let content;
  if (requests.status === 'error') {
    content = <ErrorState error={requests.error} onRetry={reload} />;
  } else if (requests.status === 'loading' && requests.items.length === 0) {
    content = <LoadingState label="Loading assistance requests…" />;
  } else if (requests.items.length === 0) {
    content = (
      <EmptyState
        icon={Inbox}
        title={statusFilter === 'open' ? 'No open requests' : 'No requests to show'}
        description="Requests from patients in your department appear here."
      />
    );
  } else {
    content = (
      <div className="space-y-4">
        <ul className="space-y-4">
          {requests.items.map((request) => (
            <li key={request.id}>
              <AssistanceRequestCard
                request={request}
                departmentsById={departmentsById}
                showDemoControls={false}
                actions={
                  <AcknowledgeButton request={request} pending={pendingId === request.id} onAcknowledge={handleAcknowledge} />
                }
              />
            </li>
          ))}
        </ul>
        {requests.moreError && <ErrorState error={requests.moreError} onRetry={requests.loadMore} />}
        {requests.hasMore && (
          <Button variant="secondary" onClick={requests.loadMore} aria-disabled={requests.loadingMore || undefined}>
            {requests.loadingMore ? 'Loading…' : 'Show older requests'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Container className="max-w-4xl space-y-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="Staff tools"
        title="Assistance requests"
        description={`${role === 'admin' ? 'Requests from patients across all departments.' : 'Requests from patients in your department.'} Acknowledge a request to record that a staff member has seen it.`}
      />

      <div className="space-y-3">
        <Notice tone="warning" title="Non-emergency requests">
          {ASSISTANCE_SAFETY_NOTICE}
        </Notice>
        {isMockAuth && (
          <Notice tone="warning" title="Simulated requests">
            These requests are fictional demo data stored in this browser. Acknowledging one changes
            the demo only and does not contact any patient.
          </Notice>
        )}
      </div>

      <div role="group" aria-labelledby="filter-label" className="space-y-2">
        <p id="filter-label" className="font-semibold text-slate-900">
          Show
        </p>
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const selected = statusFilter === filter.value;
            return (
              <li key={filter.label}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setFeedback(null);
                    setStatusFilter(filter.value);
                  }}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold',
                    selected
                      ? 'border-brand-700 bg-brand-700 text-white'
                      : 'border-slate-400 bg-white text-slate-800 hover:border-brand-700 hover:bg-brand-50',
                  )}
                >
                  {filter.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div ref={feedbackRef} tabIndex={-1} className="space-y-3">
        <div aria-live="polite">
          {feedback?.tone === 'success' && <SuccessMessage title="Request acknowledged">{feedback.message}</SuccessMessage>}
        </div>
        {feedback?.tone === 'error' && <ErrorState error={feedback.error} />}
      </div>

      <section aria-labelledby="requests-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="requests-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            Requests
            {typeof requests.meta?.total === 'number' && (
              <span className="ml-2 text-base font-medium text-slate-600">({requests.meta.total})</span>
            )}
          </h2>
          <Button variant="ghost" onClick={reload} aria-disabled={requests.status === 'loading' || undefined}>
            <RefreshCw aria-hidden="true" className={requests.status === 'loading' ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </Button>
        </div>
        {content}
      </section>
    </Container>
  );
}
