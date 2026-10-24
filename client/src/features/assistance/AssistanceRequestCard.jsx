import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/feedback/ErrorState';
import { cn } from '../../utils/cn';
import { AssistanceStatusBadge } from './AssistanceStatusBadge';
import { ASSISTANCE_STATUS_DETAILS } from './assistanceRules';
import { assistanceDemoControls } from './assistanceService';

const NOT_RETURNED = 'Not included in the service response';

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function DemoAcknowledge({ request, onUpdated }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  if (!assistanceDemoControls || request.status !== 'open') return null;

  async function handleClick() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      onUpdated(await assistanceDemoControls.acknowledge(request.id));
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3">
      <p className="flex items-center gap-1.5 text-sm text-amber-950">
        <FlaskConical aria-hidden="true" className="size-4 text-amber-700" />
        Demo only: no staff member receives this request.
      </p>
      <Button variant="secondary" onClick={handleClick} aria-disabled={pending || undefined} className="mt-2">
        {pending ? 'Updating…' : 'Simulate: staff acknowledge'}
      </Button>
      {error && <ErrorState error={error} className="mt-3" />}
    </div>
  );
}

/** One assistance request in the patient's history. */
export function AssistanceRequestCard({ request, departmentsById, onUpdated }) {
  const createdAt = formatDateTime(request.createdAt);
  const department = request.departmentId ? departmentsById?.get(request.departmentId) : null;
  const departmentText = !request.departmentId
    ? NOT_RETURNED
    : department?.name ?? 'Department details are not available right now.';
  const statusDetails = ASSISTANCE_STATUS_DETAILS[request.status];

  return (
    <article
      aria-label={`Assistance request${createdAt ? ` from ${createdAt}` : ''}, status ${statusDetails?.label ?? 'unavailable'}`}
      className={cn(
        'rounded-xl border bg-white p-5',
        request.status === 'acknowledged' ? 'border-line' : 'border-amber-300',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AssistanceStatusBadge status={request.status} />
        <p className="text-sm text-slate-600">
          {createdAt ? (
            <>
              Sent <time dateTime={request.createdAt}>{createdAt}</time>
            </>
          ) : (
            'Time not available'
          )}
        </p>
      </div>
      {statusDetails && <p className="mt-2 text-sm text-slate-700">{statusDetails.description}</p>}

      <dl className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-sm text-slate-600">Message</dt>
          <dd className="font-medium break-words whitespace-pre-line text-slate-900">{request.message || NOT_RETURNED}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Department</dt>
          <dd className="font-medium text-slate-900">{departmentText}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Location</dt>
          <dd className="font-medium break-words text-slate-900">{request.location || NOT_RETURNED}</dd>
        </div>
      </dl>

      <DemoAcknowledge request={request} onUpdated={onUpdated} />
    </article>
  );
}
