import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusWhenLost } from '../../hooks/useFocusWhenLost';
import { BellRing, ChevronDown, ListOrdered, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { Notice } from '../../components/feedback/Notice';
import { SuccessMessage } from '../../components/feedback/SuccessMessage';
import { useAsyncData } from '../../hooks/useAsyncData';
import { API_ERROR_CODES } from '../../services/apiClient';
import { StatusBadge } from '../queue/StatusBadge';
import { QUEUE_POLL_INTERVAL_MS, staffQueueService } from '../queue/queueService';
import { STATUS_DETAILS, isActiveStatus } from '../queue/queueStatus';
import { StaffTokenRow } from './StaffTokenRow';

function countBy(tokens, status) {
  return tokens.filter((token) => token.status === status).length;
}

function QueueCounts({ tokens }) {
  const items = [
    ['Waiting', countBy(tokens, 'waiting')],
    ['Called', countBy(tokens, 'called')],
    ['In consultation', countBy(tokens, 'in_consultation')],
  ];
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-line bg-white px-4 py-3">
          <dt className="text-sm text-slate-600">{label}</dt>
          <dd className="text-2xl font-semibold text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Department queue for staff/admin: counts, call-next, and per-token status actions. */
export function StaffQueueBoard({ department }) {
  const departmentId = department.id;
  const load = useCallback(
    (signal) => staffQueueService.listDepartmentQueue(departmentId, { signal }),
    [departmentId],
  );
  const queue = useAsyncData(load);
  const { reload } = queue;
  const tokens = queue.data?.items ?? [];

  const [pendingKey, setPendingKey] = useState(null);
  const [confirming, setConfirming] = useState(null); // { tokenId, status }
  const [feedback, setFeedback] = useState(null); // { tone: 'success', message } | { tone: 'error', error }
  const feedbackRef = useRef(null);
  const armFocusRestore = useFocusWhenLost(feedbackRef, queue.data);

  // Clear per-department UI state when switching department.
  useEffect(() => {
    setFeedback(null);
    setConfirming(null);
  }, [departmentId]);

  // Poll so changes made elsewhere (other staff, patient demo controls) show up.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) reload();
    }, QUEUE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [reload]);

  async function run(key, action, describeSuccess) {
    if (pendingKey) return;
    setPendingKey(key);
    setFeedback(null);
    try {
      const result = await action();
      setFeedback({ tone: 'success', message: describeSuccess(result) });
      setConfirming(null);
    } catch (error) {
      setFeedback({ tone: 'error', error });
    } finally {
      setPendingKey(null);
      armFocusRestore();
      reload();
    }
  }

  const calledToken = tokens.find((token) => token.status === 'called');
  const waitingCount = countBy(tokens, 'waiting');
  const callNextBlocked = Boolean(calledToken) || waitingCount === 0;

  function handleCallNext() {
    // The button explains why it is unavailable; the service enforces the rule regardless.
    if (callNextBlocked && queue.data) return;
    run('call-next', () => staffQueueService.callNext(departmentId), (result) => `${result.displayNumber} has been called.`);
  }

  function changeStatus(token, action) {
    run(`${token.id}:${action.status}`, () => staffQueueService.updateTokenStatus(token.id, action.status), () =>
      `${token.displayNumber} is now ${STATUS_DETAILS[action.status].label.toLowerCase()}.`,
    );
  }

  function handleRequest(token, action) {
    if (pendingKey) return;
    if (action.confirm) setConfirming({ tokenId: token.id, status: action.status });
    else changeStatus(token, action);
  }

  if (queue.status === 'error' && !queue.data) {
    const forbidden = queue.error?.code === API_ERROR_CODES.FORBIDDEN;
    return (
      <ErrorState
        error={queue.error}
        title={forbidden ? `You are not assigned to ${department.name}` : undefined}
        description={forbidden ? 'Choose the department you work in from the list above.' : undefined}
        onRetry={forbidden ? undefined : reload}
      />
    );
  }
  if (!queue.data) return <LoadingState label={`Loading the ${department.name} queue…`} />;

  const total = queue.data.meta?.total;
  const truncated = typeof total === 'number' && total > tokens.length;
  const active = tokens.filter((token) => isActiveStatus(token.status));
  const finished = tokens.filter((token) => !isActiveStatus(token.status));

  return (
    <div className="space-y-6">
      <div ref={feedbackRef} tabIndex={-1} className="space-y-3">
        <div aria-live="polite">
          {feedback?.tone === 'success' && <SuccessMessage title="Queue updated">{feedback.message}</SuccessMessage>}
        </div>
        {feedback?.tone === 'error' && <ErrorState error={feedback.error} />}
      </div>

      {truncated && (
        <Notice tone="warning" title="Showing part of this queue">
          Showing the first {tokens.length} of {total} tokens. Counts below include only the tokens shown.
        </Notice>
      )}

      <QueueCounts tokens={tokens} />

      <section aria-labelledby="call-next-heading" className="rounded-xl border border-line bg-white p-5">
        <h3 id="call-next-heading" className="font-semibold text-slate-900">
          Call the next patient
        </h3>
        <p id="call-next-help" className="mt-1 text-sm text-slate-700">
          {calledToken
            ? `${calledToken.displayNumber} is already called. Start their consultation, skip, or cancel them before calling the next patient.`
            : waitingCount === 0
              ? 'No patients are waiting in this department.'
              : `Calls the earliest waiting token. ${waitingCount} waiting.`}
        </p>
        <Button
          className="mt-3"
          onClick={handleCallNext}
          aria-disabled={callNextBlocked || Boolean(pendingKey) || undefined}
          aria-describedby="call-next-help"
        >
          <BellRing aria-hidden="true" className="size-5" />
          {pendingKey === 'call-next' ? 'Calling…' : 'Call next patient'}
        </Button>
      </section>

      <section aria-labelledby="active-queue-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="active-queue-heading" className="text-lg font-semibold text-slate-900">
            Active tokens ({active.length})
          </h3>
          <Button variant="ghost" onClick={reload} aria-disabled={queue.status === 'loading' || undefined}>
            <RefreshCw aria-hidden="true" className={queue.status === 'loading' ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </Button>
        </div>
        {active.length === 0 ? (
          <EmptyState icon={ListOrdered} title="No active tokens" description="New tokens appear here when patients join this queue." />
        ) : (
          <ol className="space-y-3">
            {active.map((token) => (
              <StaffTokenRow
                key={token.id}
                token={token}
                pendingKey={pendingKey}
                confirming={confirming?.tokenId === token.id ? confirming.status : null}
                onRequest={handleRequest}
                onConfirm={changeStatus}
                onDismiss={() => setConfirming(null)}
              />
            ))}
          </ol>
        )}
      </section>

      {finished.length > 0 && (
        <details className="group rounded-xl border border-line bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-3 font-semibold text-slate-900 hover:bg-canvas-muted [&::-webkit-details-marker]:hidden">
            Finished tokens ({finished.length})
            <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {finished.map((token) => (
              <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="font-semibold text-slate-900">{token.displayNumber}</span>
                <StatusBadge status={token.status} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
