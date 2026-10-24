import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/feedback/ErrorState';
import { useTranslation } from '../../hooks/useTranslation';
import { queueDemoControls } from './queueService';

function getActions(token) {
  const actions = [];
  if (token.status === 'waiting' && token.patientsAhead > 0) {
    actions.push({ key: 'advance', labelKey: 'demo.controls.advance', run: () => queueDemoControls.advanceQueue(token.id) });
  }
  if (token.status === 'waiting' && token.patientsAhead === 0) {
    actions.push({ key: 'called', labelKey: 'demo.controls.call', status: 'called' });
  }
  if (token.status === 'called') {
    actions.push({ key: 'in_consultation', labelKey: 'demo.controls.start', status: 'in_consultation' });
    actions.push({ key: 'skipped', labelKey: 'demo.controls.skip', status: 'skipped' });
  }
  if (token.status === 'in_consultation') {
    actions.push({ key: 'completed', labelKey: 'demo.controls.complete', status: 'completed' });
  }
  if (['waiting', 'called', 'in_consultation'].includes(token.status)) {
    actions.push({ key: 'cancelled', labelKey: 'demo.controls.cancel', status: 'cancelled', variant: 'danger' });
  }
  return actions;
}

/**
 * Mock-mode-only panel for simulating what hospital staff would do to a token, so the
 * patient views can be demonstrated. Renders nothing when connected to the real API.
 */
export function DemoQueueControls({ token, onUpdated }) {
  const [pendingKey, setPendingKey] = useState(null);
  const { t } = useTranslation();
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
        {t('demo.controls.title')}
      </h2>
      <p className="mt-1 text-sm text-amber-950">{t('demo.controls.body')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant ?? 'secondary'}
            onClick={() => runAction(action)}
            aria-disabled={Boolean(pendingKey) || undefined}
          >
            {pendingKey === action.key ? t('common.updating') : t('demo.controls.simulate', { action: t(action.labelKey) })}
          </Button>
        ))}
      </div>
      {error && <ErrorState error={error} className="mt-4" />}
    </section>
  );
}
