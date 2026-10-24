import { useEffect, useRef } from 'react';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../queue/StatusBadge';
import { formatWaitMinutes } from '../queue/queueStatus';

/**
 * Status changes staff can request from a row (PATCH …/status). `called` is reached only via
 * "Call next patient". The service re-validates every change; this list only decides which
 * buttons to offer.
 */
const ROW_ACTIONS = {
  waiting: [{ status: 'cancelled', label: 'Cancel', confirm: true, variant: 'ghost' }],
  called: [
    { status: 'in_consultation', label: 'Start consultation' },
    { status: 'skipped', label: 'Skip', confirm: true, variant: 'secondary' },
    { status: 'cancelled', label: 'Cancel', confirm: true, variant: 'ghost' },
  ],
  in_consultation: [
    { status: 'completed', label: 'Complete consultation' },
    { status: 'cancelled', label: 'Cancel', confirm: true, variant: 'ghost' },
  ],
};

const CONFIRM_TEXT = {
  cancelled: 'Cancel this token? The patient will need a new token to rejoin the queue.',
  skipped: 'Mark this token as skipped because the patient was not present? This cannot be undone.',
};

function ConfirmPrompt({ token, action, pending, onConfirm, onDismiss }) {
  const confirmRef = useRef(null);
  useEffect(() => confirmRef.current?.focus(), []);

  return (
    <div role="group" aria-label={`Confirm action for ${token.displayNumber}`} className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-950">{CONFIRM_TEXT[action.status]}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button ref={confirmRef} onClick={onConfirm} aria-disabled={pending || undefined}>
          {pending ? 'Updating…' : `Yes, ${action.label.toLowerCase()} ${token.displayNumber}`}
        </Button>
        <Button variant="secondary" onClick={onDismiss}>
          Keep token
        </Button>
      </div>
    </div>
  );
}

/** One token in the staff queue with the actions its status allows. */
export function StaffTokenRow({ token, pendingKey, confirming, onRequest, onConfirm, onDismiss }) {
  const actions = ROW_ACTIONS[token.status] ?? [];
  const confirmAction = confirming ? actions.find((action) => action.status === confirming) : null;
  const rowRef = useRef(null);
  const returnFocusTo = useRef(null);

  // After "Keep token", move focus back to the button that opened the prompt instead of
  // leaving it on the removed prompt (which drops keyboard focus to the page body).
  useEffect(() => {
    if (confirmAction || !returnFocusTo.current) return;
    rowRef.current?.querySelector(`[data-action="${returnFocusTo.current}"]`)?.focus();
    returnFocusTo.current = null;
  }, [confirmAction]);

  return (
    <li ref={rowRef} className="rounded-xl border border-line bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-2xl font-bold tracking-tight text-slate-900">{token.displayNumber}</span>
          <StatusBadge status={token.status} />
        </div>
        {token.status === 'waiting' && typeof token.patientsAhead === 'number' && (
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{token.patientsAhead}</span> ahead ·{' '}
            {formatWaitMinutes(token.estimatedWaitMinutes)}{' '}
            <span className="rounded border border-line bg-canvas-muted px-1.5 text-xs font-medium">
              {token.estimateLabel || 'Simulated estimate'}
            </span>
          </p>
        )}
      </div>

      {actions.length > 0 && !confirmAction && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => {
            const key = `${token.id}:${action.status}`;
            return (
              <Button
                key={action.status}
                data-action={action.status}
                variant={action.variant ?? 'primary'}
                onClick={() => onRequest(token, action)}
                aria-disabled={Boolean(pendingKey) || undefined}
              >
                {pendingKey === key ? 'Updating…' : action.label}
                <span className="sr-only"> token {token.displayNumber}</span>
              </Button>
            );
          })}
        </div>
      )}

      {confirmAction && (
        <ConfirmPrompt
          token={token}
          action={confirmAction}
          pending={pendingKey === `${token.id}:${confirmAction.status}`}
          onConfirm={() => onConfirm(token, confirmAction)}
          onDismiss={() => {
            returnFocusTo.current = confirmAction.status;
            onDismiss();
          }}
        />
      )}
    </li>
  );
}
