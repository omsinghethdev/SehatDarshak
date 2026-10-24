import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/feedback/ErrorState';
import { queueDemoControls } from './queueService';

function getActions(token) {
  const actions = [];
  if (token.status === 'waiting' && token.patientsAhead > 0) {
    actions.push({ key: 'advance', label: 'One patient ahead is seen', run: () => queueDemoControls.advanceQueue(token.id) });
  }
  if (token.status === 'waiting' && token.patientsAhead === 0) {
    actions.push({ key: 'called', label: 'Staff call this token', status: 'called' });
  }
  if (token.status === 'called') {
    actions.push({ key: 'in_consultation', label: 'Consultation starts', status: 'in_consultation' });
    actions.push({ key: 'skipped', label: 'Patient not present — skip', status: 'skipped' });
  }
  if (token.status === 'in_consultation') {
    actions.push({ key: 'completed', label: 'Consultation completed', status: 'completed' });
  }
  if (['waiting', 'called', 'in_consultation'].includes(token.status)) {
    actions.push({ key: 'cancelled', label: 'Staff cancel this token', status: 'cancelled', variant: 'ghost' });
  }
  return actions;
}

/**
 * Mock-mode-only panel for simulating what hospital staff would do to a token, so the
 * patient views can be demonstrated. Renders nothing when connected to the real API.
 */
export function DemoQueueControls({ token, onUpdated }) {
  const [pendingKey, setPendingKey] = useState(null);
  const [error, setError] = useState(null);

  if (!queueDemoControls) return null;
  const actions = getActions(token);
  if (actions.length === 0) return null;

  async function runAction(action) {
    if (pendingKey) return;
    setPendingKey(action.key);
    setError(null);
    try {
      const updated = action.run
        ? await action.run()
        : await queueDemoControls.changeStatus(token.id, action.status);
      onUpdated(updated);
    } catch (caught) {
      setError(caught);
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section
      aria-labelledby="demo-controls-heading"
      className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-5"
    >
      <h2 id="demo-controls-heading" className="flex items-center gap-2 font-semibold text-amber-950">
        <FlaskConical aria-hidden="true" className="size-5 text-amber-700" />
        Demo controls: simulate staff actions
      </h2>
      <p className="mt-1 text-sm text-amber-950">
        These buttons pretend to be hospital staff so you can see how this page changes. They only
        change demo data in this browser — no real hospital queue is updated.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant ?? 'secondary'}
            onClick={() => runAction(action)}
            aria-disabled={Boolean(pendingKey) || undefined}
          >
            {pendingKey === action.key ? 'Updating…' : `Simulate: ${action.label}`}
          </Button>
        ))}
      </div>
      {error && <ErrorState error={error} className="mt-4" />}
    </section>
  );
}
